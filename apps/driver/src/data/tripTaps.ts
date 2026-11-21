/**
 * Trip taps (website firestore.rules, tripTaps/{bookingId}): the driver's own
 * taps on the job screen — left for the pickup, arrived, job done and, after a
 * one-way drop, reached home. Each time is the server's clock, set once and in
 * order, and only by the driver the booking is assigned to. The alerts robot
 * copies them to the booking: the trip clock for outstation / one-way, or the
 * bill for a local job (which then completes by itself) — so a time can never
 * be changed from the app, only by the office.
 */

import { type PackageId, toDate } from '@drivebuddy/shared';
import { doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore';

import { firestore } from '@/firebase/app';

import { type WriteFailure, failureOf, within } from './write';

export type TapStep = 'leftAt' | 'arrivedAt' | 'doneAt' | 'homeAt';

export type TripTaps = {
  driverPhone: string;
  leftAt?: Date;
  arrivedAt?: Date;
  doneAt?: Date;
  homeAt?: Date;
};

/** The taps a job has, in order: "Reached home" only after a one-way drop (he comes back by bus or train). */
export function tapSteps(packageId: PackageId | null): TapStep[] {
  return packageId === 'one-way-drop'
    ? ['leftAt', 'arrivedAt', 'doneAt', 'homeAt']
    : ['leftAt', 'arrivedAt', 'doneAt'];
}

/**
 * The button to show next, or null when every tap is done. It is the step
 * after the last one set (not the first one missing), so an odd document can
 * never ask for a time that would come before one already saved.
 */
export function nextTap(taps: TripTaps | null, packageId: PackageId | null): TapStep | null {
  const steps = tapSteps(packageId);
  let last = -1;
  steps.forEach((s, i) => {
    if (taps?.[s]) last = i;
  });
  return steps[last + 1] ?? null;
}

/** May `step` be written now? 'already' = it is saved (a second tap, or another phone). */
export function tapCheck(
  taps: TripTaps | null,
  step: TapStep,
  packageId: PackageId | null,
): 'ok' | 'already' | 'order' {
  if (taps?.[step]) return 'already';
  return nextTap(taps, packageId) === step ? 'ok' : 'order';
}

export type JobButtons = {
  /** The next tap, or null when every tap is done. */
  tap: TapStep | null;
  /** On his way but not sharing (the app or phone was restarted, permission was off): start it again. */
  shareAgain: boolean;
  /** Sharing when he should not be (after Arrived, or a Start whose tap was not saved): let him stop it. */
  stopSharing: boolean;
};

/** What the job screen offers, from his saved taps and whether this phone is sharing on this job. */
export function jobButtons(
  taps: TripTaps | null,
  packageId: PackageId | null,
  sharingThis: boolean,
): JobButtons {
  const tap = nextTap(taps, packageId);
  return {
    tap,
    shareAgain: tap === 'arrivedAt' && !sharingThis,
    stopSharing: sharingThis && tap !== 'arrivedAt',
  };
}

/** The saved times, in order, for "Trip times" on the job screen. */
export function tapTimes(taps: TripTaps | null, packageId: PackageId | null): { step: TapStep; at: Date }[] {
  return tapSteps(packageId).flatMap((step) => {
    const at = taps?.[step];
    return at ? [{ step, at }] : [];
  });
}

export function toTripTaps(d: Record<string, unknown>): TripTaps {
  return {
    driverPhone: typeof d.driverPhone === 'string' ? d.driverPhone : '',
    leftAt: toDate(d.leftAt),
    arrivedAt: toDate(d.arrivedAt),
    doneAt: toDate(d.doneAt),
    homeAt: toDate(d.homeAt),
  };
}

/**
 * His taps on one job, live — also the ones made before the app was closed or
 * the phone restarted. null = none yet. A refused read (the job is no longer
 * his) is reported as `undefined` so the screen keeps the last times it had.
 */
export function watchTripTaps(id: string, onChange: (taps: TripTaps | null | undefined) => void): () => void {
  return onSnapshot(
    doc(firestore(), 'tripTaps', id),
    // A tap still on its way to the server shows the phone's estimate of the time.
    (snap) => onChange(snap.exists() ? toTripTaps(snap.data({ serverTimestamps: 'estimate' })) : null),
    () => onChange(undefined),
  );
}

export type TapResult = { ok: true; already: boolean } | { ok: false; reason: WriteFailure | 'order' };

class TapRefused extends Error {}

/**
 * Save one tap. In a transaction so that the check (not saved yet, in order)
 * and the write see the same document; the rules check the same again. The
 * first tap creates the document with his number; later taps add only their
 * own time, so a tap can never overwrite an earlier one.
 */
export async function tapTrip(
  bookingId: string,
  step: TapStep,
  packageId: PackageId | null,
  driverPhone: string,
): Promise<TapResult> {
  const db = firestore();
  const ref = doc(db, 'tripTaps', bookingId);
  try {
    const outcome = await within(
      runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const taps = snap.exists() ? toTripTaps(snap.data()) : null;
        const check = tapCheck(taps, step, packageId);
        if (check === 'already') return 'already' as const;
        if (check === 'order') throw new TapRefused('order');
        if (snap.exists()) tx.update(ref, { [step]: serverTimestamp() });
        else tx.set(ref, { driverPhone, [step]: serverTimestamp() });
        return 'saved' as const;
      }),
    );
    return { ok: true, already: outcome === 'already' };
  } catch (err) {
    if (err instanceof TapRefused) return { ok: false, reason: 'order' };
    return { ok: false, reason: failureOf(err) };
  }
}

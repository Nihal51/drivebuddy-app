/**
 * Bookings in Firestore: the same `bookings` collection the website writes, so
 * app bookings get a DB number, Telegram/email alerts and a row in the Google
 * Sheet from the alerts robot with no extra work.
 */

import {
  type Booking,
  type BookingInput,
  newBookingFields,
  sortNewestFirst,
  toBooking,
} from '@drivebuddy/shared';
import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';

import { isFirebaseConfigured } from '@/env';
import { firestore } from '@/firebase/app';
import { reportError } from '@/lib/monitoring';

export type SubmitFailure = 'config' | 'permission' | 'network' | 'timeout' | 'unknown';
export type SubmitResult = { ok: true; id: string } | { ok: false; reason: SubmitFailure; id?: string };

/** After this long without a reply from Firestore, offer WhatsApp instead of a spinner. */
export const SUBMIT_TIMEOUT_MS = 20_000;

/**
 * Save a checked booking. Never throws: every failure comes back as a reason
 * the screen turns into words, with WhatsApp as the way out — an outage must
 * never cost a booking.
 */
export async function submitBooking(
  input: BookingInput,
  customerUid: string | null,
  opts: { pingUrl?: string; timeoutMs?: number } = {},
): Promise<SubmitResult> {
  if (!isFirebaseConfigured()) return { ok: false, reason: 'config' };

  let id: string | undefined;
  try {
    const fields = newBookingFields(input, customerUid);
    // The id is made on the phone, so even a slow save can be traced later.
    const ref = doc(collection(firestore(), 'bookings'));
    id = ref.id;
    const save = setDoc(ref, { ...fields, createdAt: serverTimestamp() }).then(() => 'saved' as const);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<'timeout'>((resolve) => {
      timer = setTimeout(() => resolve('timeout'), opts.timeoutMs ?? SUBMIT_TIMEOUT_MS);
    });
    const outcome = await Promise.race([save, timedOut]).finally(() => clearTimeout(timer));
    // A slow save keeps going in the background and may still arrive; the
    // customer is offered WhatsApp meanwhile rather than an endless spinner.
    if (outcome === 'timeout') return { ok: false, reason: 'timeout', id };
    if (opts.pingUrl) pingAlerts(opts.pingUrl);
    return { ok: true, id };
  } catch (err) {
    if (__DEV__) console.warn('[drivebuddy] booking failed', err);
    const reason = failureReason(err);
    // Offline is expected; a refusal or an unknown error is worth a report.
    if (reason !== 'network') reportError(err, `booking:${reason}`);
    return { ok: false, reason, id };
  }
}

export function failureReason(err: unknown): SubmitFailure {
  const code = typeof err === 'object' && err && 'code' in err ? String((err as { code: unknown }).code) : '';
  if (code.includes('permission-denied')) return 'permission';
  if (code.includes('unavailable') || code.includes('network')) return 'network';
  return 'unknown';
}

/**
 * Ring the alerts robot so Telegram arrives in seconds instead of within a
 * minute. Fire-and-forget: it carries no data and a failure changes nothing.
 */
function pingAlerts(url: string) {
  fetch(url, { method: 'POST' }).catch(() => {});
}

/** Live list of the signed-in customer's bookings, newest first. Returns an unsubscribe. */
export function watchMyBookings(
  uid: string,
  onData: (bookings: Booking[]) => void,
  onError: (err: unknown) => void,
): () => void {
  // One equality filter only: no composite index needed. Sorted on the phone.
  const q = query(collection(firestore(), 'bookings'), where('customerUid', '==', uid));
  return onSnapshot(
    q,
    (snap) => onData(sortNewestFirst(snap.docs.map((d) => toBooking(d.id, d.data())))),
    onError,
  );
}

/** Live view of one booking. `null` = not found or not this customer's. */
export function watchBooking(
  id: string,
  onData: (booking: Booking | null) => void,
  onError: (err: unknown) => void,
): () => void {
  return onSnapshot(
    doc(firestore(), 'bookings', id),
    (snap) => onData(snap.exists() ? toBooking(snap.id, snap.data()) : null),
    onError,
  );
}

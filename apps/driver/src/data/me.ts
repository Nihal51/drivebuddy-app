/**
 * His own driver record (drivers/{driverId}; the rules let a driver read only
 * his own): name, city and status from the office; his UPI ID, which he sets
 * himself on My earnings for the weekly payouts; and his rating and strikes,
 * which only the alerts robot writes (customers' stars, jobs given back) —
 * as is lastAlert, whether the last push reached his phone.
 */

import { type AlertResult, toAlertResult } from '@drivebuddy/shared';
import { doc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore';

import { firestore } from '@/firebase/app';

import { type WriteFailure, failureOf, within } from './write';

export type MyRecord = {
  name: string;
  city: string;
  status: string;
  /** '' until he saves one. */
  upi: string;
  /** Only when at least one customer has rated him. */
  ratingAvg?: number;
  ratingCount: number;
  strikes: number;
  /** What became of the last push to his phone (robot-written; absent until one has gone). */
  lastAlert?: AlertResult;
};

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const count = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : 0);

export function toMyRecord(d: Record<string, unknown>): MyRecord {
  const ratingCount = count(d.ratingCount);
  const avg = d.ratingAvg;
  const lastAlert = toAlertResult(d.lastAlert);
  return {
    name: str(d.name),
    city: str(d.city),
    status: str(d.status),
    upi: str(d.upi),
    ...(ratingCount > 0 && typeof avg === 'number' && avg >= 1 && avg <= 5 ? { ratingAvg: avg } : {}),
    ratingCount,
    strikes: count(d.strikes),
    ...(lastAlert ? { lastAlert } : {}),
  };
}

/** His record once, or null (the review login has none, or it cannot be read). */
export async function readMyRecord(driverId: string): Promise<MyRecord | null> {
  if (!driverId) return null;
  try {
    const snap = await getDoc(doc(firestore(), 'drivers', driverId));
    return snap.exists() ? toMyRecord(snap.data()) : null;
  } catch {
    return null;
  }
}

/** His record, live (a saved UPI ID, a new rating). */
export function watchMyRecord(driverId: string, onChange: (me: MyRecord | null) => void): () => void {
  if (!driverId) {
    onChange(null);
    return () => {};
  }
  return onSnapshot(
    doc(firestore(), 'drivers', driverId),
    (snap) => onChange(snap.exists() ? toMyRecord(snap.data()) : null),
    () => onChange(null),
  );
}

/* ------------------------------------------------------------ UPI */

/** The same pattern firestore.rules checks: "name@bank", e.g. raju.sahu@okaxis or 9893302783@ybl. */
export const UPI_PATTERN = /^[a-zA-Z0-9.\-_]{2,64}@[a-zA-Z]{2,32}$/;

/** What he typed → the ID to save: spaces are a typing slip, never part of a UPI ID. */
export const cleanUpi = (typed: string) => typed.replace(/\s+/g, '');

export const isUpi = (upi: string) => UPI_PATTERN.test(upi);

export type SaveResult = { ok: true } | { ok: false; reason: 'invalid' | WriteFailure };

/** Save his UPI ID (only that field: the rest of his record is the office's). */
export async function saveUpi(driverId: string, typed: string): Promise<SaveResult> {
  const upi = cleanUpi(typed);
  if (!isUpi(upi)) return { ok: false, reason: 'invalid' };
  try {
    await within(updateDoc(doc(firestore(), 'drivers', driverId), { upi }));
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: failureOf(err) };
  }
}

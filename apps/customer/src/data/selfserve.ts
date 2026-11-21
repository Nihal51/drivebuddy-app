/**
 * The customer's own writes after booking: accepting a trip price, and the
 * rating after the job. Each is the smallest write firestore.rules allows
 * (website repo), and none ever throws — the screen turns the outcome into
 * words.
 */

import { type NewRatingFields, newRatingFields } from '@drivebuddy/shared';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

import { firestore } from '@/firebase/app';
import { readStored, writeStored } from '@/lib/storage';
import { reportError } from '@/lib/monitoring';

import { type SubmitFailure, failureReason } from './bookings';

export type WriteResult = { ok: true } | { ok: false; reason: SubmitFailure };

/**
 * "Accept price ₹X": exactly `acceptedPrice` and nothing else (the rules
 * check changedOnly(['acceptedPrice']), amount == trip.estTo, at == request.time).
 */
export async function acceptPrice(bookingId: string, amount: number): Promise<WriteResult> {
  try {
    await updateDoc(doc(firestore(), 'bookings', bookingId), {
      acceptedPrice: { amount, at: serverTimestamp() },
    });
    return { ok: true };
  } catch (err) {
    const reason = failureReason(err);
    if (reason !== 'network') reportError(err, `accept-price:${reason}`);
    return { ok: false, reason };
  }
}

/**
 * 'rated' — a rating exists; 'open' — none yet; 'unknown' — the rules do not
 * let customers read ratings (admins only), or we are offline: let them try
 * once, and a refusal then means it was already rated.
 */
export type RatingState = 'rated' | 'open' | 'unknown';

export async function ratingState(bookingId: string): Promise<RatingState> {
  try {
    const snap = await getDoc(doc(firestore(), 'ratings', bookingId));
    return snap.exists() ? 'rated' : 'open';
  } catch {
    return 'unknown';
  }
}

export type RatingResult = 'ok' | 'already' | 'invalid' | 'network' | 'unknown';

/**
 * Create `ratings/{bookingId}` once. A second setDoc would be an update,
 * which the rules refuse — so a refusal is read as "already rated".
 */
export async function submitRating(
  bookingId: string,
  stars: number,
  comment: string,
  driverId: string,
  customerUid: string,
): Promise<RatingResult> {
  const fields: NewRatingFields | null = newRatingFields(stars, comment, driverId, customerUid);
  if (!fields) return 'invalid';
  try {
    await setDoc(doc(firestore(), 'ratings', bookingId), { ...fields, at: serverTimestamp() });
    return 'ok';
  } catch (err) {
    const reason = failureReason(err);
    if (reason === 'permission') return 'already';
    if (reason !== 'network') reportError(err, `rating:${reason}`);
    return reason === 'network' ? 'network' : 'unknown';
  }
}

/* Remembered on the phone, so a rated booking says "thanks" without asking the server again. */
const ratedKey = (bookingId: string) => `db.rated.${bookingId}`;

/** The stars given on this phone (0 = rated, stars unknown), or null if not rated here. */
export async function ratedOnPhone(bookingId: string): Promise<number | null> {
  const raw = await readStored(ratedKey(bookingId));
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= 5 ? n : 0;
}

export const rememberRated = (bookingId: string, stars: number) =>
  writeStored(ratedKey(bookingId), String(stars));

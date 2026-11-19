/**
 * The driver's live location on a booking (tracking/{bookingId}), written by
 * the DriveBuddy Driver app between his taps on Start and Arrived.
 * firestore.rules lets the customer who booked while logged in read it.
 */

import { toDate } from '@drivebuddy/shared';
import { doc, onSnapshot } from 'firebase/firestore';

import { firestore } from '@/firebase/app';

export type DriverSpot = { lat: number; lng: number; active: boolean; at: Date };

/** Older than this, the map says the location has not updated for a while. */
export const STALE_MS = 5 * 60_000;

/** A stored document → a spot in India, or null. */
export function readSpot(data: Record<string, unknown> | undefined): DriverSpot | null {
  if (!data) return null;
  const lat = Number(data.lat);
  const lng = Number(data.lng);
  const at = toDate(data.at);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 6 || lat > 37 || lng < 68 || lng > 98 || !at)
    return null;
  return { lat, lng, active: data.active === true, at };
}

/** Whole minutes since the last update (never negative). */
export const minutesAgo = (spot: DriverSpot, now: number) =>
  Math.max(0, Math.floor((now - spot.at.getTime()) / 60_000));

export function watchDriverSpot(bookingId: string, onChange: (spot: DriverSpot | null) => void): () => void {
  return onSnapshot(
    doc(firestore(), 'tracking', bookingId),
    (snap) => onChange(snap.exists() ? readSpot(snap.data()) : null),
    // No tracking yet, or rules not published: just no map.
    () => onChange(null),
  );
}

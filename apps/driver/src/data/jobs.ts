/**
 * The driver's jobs: bookings the office assigned to his number in /admin and
 * that are still "assigned". firestore.rules lets a driver read exactly these
 * (isMyJob), so the query below must ask for exactly that.
 */

import { type Booking, type PickupGeo, readPickupGeo, toBooking, tripInstant } from '@drivebuddy/shared';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';

import { firestore } from '@/firebase/app';

export type Job = Booking & { pickupGeo: PickupGeo | null };

export const toJob = (id: string, data: Record<string, unknown>): Job => ({
  ...toBooking(id, data),
  pickupGeo: readPickupGeo(data.pickupGeo),
});

/** The job to do first on top: "as soon as possible" first, then by time; same time → older booking first. */
export function sortJobs(jobs: Job[]): Job[] {
  const when = (j: Job) =>
    j.preferredTime.trim() ? (tripInstant(j.preferredTime)?.getTime() ?? Number.MAX_SAFE_INTEGER) : 0;
  const made = (j: Job) => j.createdAt?.getTime() ?? 0;
  return [...jobs].sort((a, b) => when(a) - when(b) || made(a) - made(b));
}

/** Directions to the pickup in Google Maps: to the pinned spot if there is one, else to the typed address. */
export function navigateUrl(job: Pick<Job, 'pickup' | 'pickupGeo' | 'city'>): string {
  const destination = job.pickupGeo
    ? `${job.pickupGeo.lat},${job.pickupGeo.lng}`
    : encodeURIComponent(`${job.pickup}, ${job.city}`);
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
}

type Listener = (jobs: Job[] | null, error?: unknown) => void;

/** Live list of this driver's jobs; null + error when it cannot be read. Returns the unsubscribe. */
export function watchJobs(phone: string, onChange: Listener): () => void {
  const q = query(
    collection(firestore(), 'bookings'),
    where('assignedDriver.phone', '==', phone),
    where('status', '==', 'assigned'),
  );
  return onSnapshot(
    q,
    (snap) => onChange(sortJobs(snap.docs.map((d) => toJob(d.id, d.data())))),
    (err) => onChange(null, err),
  );
}

/** One job, live; null once it is no longer his (completed, cancelled, reassigned). */
export function watchJob(id: string, onChange: (job: Job | null) => void): () => void {
  return onSnapshot(
    doc(firestore(), 'bookings', id),
    (snap) => onChange(snap.exists() ? toJob(snap.id, snap.data()) : null),
    // The rules refuse a booking that is no longer assigned to him: same as gone.
    () => onChange(null),
  );
}

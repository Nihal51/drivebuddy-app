/**
 * The driver's jobs: bookings the office assigned to his number in /admin and
 * that are still "assigned". firestore.rules lets a driver read exactly these
 * (isMyJob), so the query below must ask for exactly that.
 *
 * A driver never sees what the customer pays or DriveBuddy's cut — only his
 * own pay (on the offer). The booking he reads still holds the customer's
 * money (quote, trip estimate, bills, payment, accepted price), so a Job is
 * built without any of it: no screen can show what is not there.
 */

import {
  type Booking,
  type BookingTrip,
  type PickupGeo,
  readPickupGeo,
  toBooking,
  toDate,
  tripInstant,
} from '@drivebuddy/shared';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';

import { firestore } from '@/firebase/app';

/** The customer's money on a booking: never part of a Job. */
type MoneyKeys = 'quote' | 'bill' | 'acceptedPrice' | 'localBill' | 'payment';

/** DriveBuddy called him and confirmed the job (robot-written; absent until then). */
export type DriverConfirmed = { at?: Date; by: string; driverId: string };

export type Job = Omit<Booking, MoneyKeys | 'trip'> & {
  /** Where and how long — without the customer's estimate. */
  trip?: Omit<BookingTrip, 'estFrom' | 'estTo'>;
  pickupGeo: PickupGeo | null;
  driverConfirmed?: DriverConfirmed;
};

export function toDriverConfirmed(v: unknown): DriverConfirmed | undefined {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return undefined;
  const d = v as Record<string, unknown>;
  const str = (x: unknown) => (typeof x === 'string' ? x : '');
  const at = toDate(d.at);
  return { ...(at ? { at } : {}), by: str(d.by), driverId: str(d.driverId) };
}

/** Confirmed for him: a confirmation that names another driver (the job was his before) does not count. */
export const confirmedForMe = (job: Pick<Job, 'driverConfirmed'>, driverId: string): boolean =>
  Boolean(job.driverConfirmed) &&
  (!job.driverConfirmed?.driverId || job.driverConfirmed.driverId === driverId);

/**
 * A rupee figure in free text ("est. ₹5,620–5,820", "Rs 1500", "INR 900") →
 * "₹…". Notes are typed by the customer and the team; the app also writes the
 * trip line with its estimate into them for a website that does not take
 * `trip` yet (shared notesWithTrip).
 */
const RUPEES = /(₹|\brs\.?|\binr)\s*\d+(,\d+)*(\.\d+)?(\s*[–-]\s*₹?\s*\d+(,\d+)*(\.\d+)?)?/gi;

/** The notes as the driver sees them: the trip line without its estimate, any other price masked. */
export function notesForDriver(notes: string): string {
  return notes
    .split('\n')
    .map((line) =>
      line.startsWith('Trip: ')
        ? line
            .split(' · ')
            .filter((part) => !/^(est\. |quote on the call)/.test(part))
            .join(' · ')
        : line,
    )
    .join('\n')
    .replace(RUPEES, '₹…');
}

export function toJob(id: string, data: Record<string, unknown>): Job {
  const { quote, bill, acceptedPrice, localBill, payment, trip, notes, ...rest } = toBooking(id, data);
  void [quote, bill, acceptedPrice, localBill, payment]; // taken out on purpose: the customer's money
  const job: Job = { ...rest, notes: notesForDriver(notes), pickupGeo: readPickupGeo(data.pickupGeo) };
  if (trip) {
    const { estFrom, estTo, ...where } = trip;
    void [estFrom, estTo];
    job.trip = where;
  }
  const confirmed = toDriverConfirmed(data.driverConfirmed);
  if (confirmed) job.driverConfirmed = confirmed;
  return job;
}

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

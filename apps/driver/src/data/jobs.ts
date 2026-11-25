/**
 * The driver's jobs: bookings assigned to him, still "assigned", and
 * confirmed by DriveBuddy for him (`driverConfirmed.driverId` = his driver
 * id, after the office's call). firestore.rules lets a driver read exactly
 * these, so the queries below must ask for exactly that. Until the call, a
 * job he took shows only as "Waiting for confirmation" from his offer (no
 * customer details: the booking is not readable to him yet).
 *
 * "Assigned to him" is by his driver id (`assignedDriver.id`, SPEC-privacy
 * 25 Nov 2026: bookings stop carrying his number, so customers never get
 * it). Bookings from before that may name him by number only, so a second
 * query by number picks up those — and only those without an id — until the
 * robot's HIDE_DRIVER_PHONE backfill has given every booking an id.
 *
 * A driver never sees what the customer pays or DriveBuddy's cut — only his
 * own pay (on the offer). The booking he reads still holds the customer's
 * money (quote, trip estimate, bills, payment, accepted price, the price with
 * each train home), so a Job is built without any of it: no screen can show
 * what is not there.
 */

import {
  type Booking,
  type BookingTrip,
  type PickupGeo,
  type ReturnCheck,
  type ReturnCheckOption,
  readPickupGeo,
  toBooking,
  tripInstant,
} from '@drivebuddy/shared';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';

import { firestore } from '@/firebase/app';

/** The customer's money on a booking: never part of a Job (returnPrice: the final price with his train). */
type MoneyKeys = 'quote' | 'bill' | 'acceptedPrice' | 'localBill' | 'payment' | 'returnPrice';

/** A train home the robot found at the drop, as the driver sees it: no price, no wait charge. */
export type JobTrain = Omit<ReturnCheckOption, 'waitCharge' | 'price'>;

/** The robot's train check at the drop, without the customer's prices. */
export type JobReturnCheck = Omit<ReturnCheck, 'options'> & { options: JobTrain[] };

/** The customer's "Change driver" (and why) and the drivers taken off before him: not his to read. */
type CustomerKeys = 'driverChangeRequest' | 'changedDrivers';

export type Job = Omit<Booking, MoneyKeys | CustomerKeys | 'trip' | 'returnCheck'> & {
  /** Where and how long — without the customer's estimate. */
  trip?: Omit<BookingTrip, 'estFrom' | 'estTo'>;
  /** After a one-way drop over 160 km: the trains home (the customer books his ticket), without prices. */
  returnCheck?: JobReturnCheck;
  pickupGeo: PickupGeo | null;
};

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
  const {
    quote,
    bill,
    acceptedPrice,
    localBill,
    payment,
    returnPrice,
    driverChangeRequest,
    changedDrivers,
    returnCheck,
    trip,
    notes,
    ...rest
  } = toBooking(id, data);
  void [quote, bill, acceptedPrice, localBill, payment, returnPrice]; // taken out on purpose: the customer's money
  void [driverChangeRequest, changedDrivers]; // and the customer's own business
  const job: Job = { ...rest, notes: notesForDriver(notes), pickupGeo: readPickupGeo(data.pickupGeo) };
  if (returnCheck) {
    job.returnCheck = {
      ...returnCheck,
      // Each train without what the customer pays with it.
      options: returnCheck.options.map(({ waitCharge, price, ...train }) => {
        void [waitCharge, price];
        return train;
      }),
    };
  }
  if (trip) {
    const { estFrom, estTo, ...where } = trip;
    void [estFrom, estTo];
    job.trip = where;
  }
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

type Filters = [string, '==', string][];

/**
 * The My jobs queries' filters (field, '==', value): the same conditions the
 * rules check (isMyJob, isConfirmedMe) — by his driver id, and by his number
 * for bookings from before 25 Nov 2026 (see mergeJobs).
 */
export function myJobsQueries(phone: string, driverId: string): { byId: Filters; byPhone: Filters } {
  const rest: Filters = [
    ['status', '==', 'assigned'],
    ['driverConfirmed.driverId', '==', driverId],
  ];
  return {
    byId: [['assignedDriver.id', '==', driverId], ...rest],
    byPhone: [['assignedDriver.phone', '==', phone], ...rest],
  };
}

/**
 * The two lists → his jobs, each once, in order. From the list by number only
 * bookings that name nobody by id count: one that has an id is his only if it
 * is his id (and then it is in the list by id too). `undefined` = not loaded
 * yet, null = it could not be read (once the rules drop the number, that
 * query is refused); null only when neither could be read.
 */
export function mergeJobs(
  byId: Job[] | null | undefined,
  byPhone: Job[] | null | undefined,
  driverId: string,
): Job[] | null {
  if (byId === null && byPhone === null) return null;
  const jobs = new Map<string, Job>();
  for (const j of byId ?? []) jobs.set(j.id, j);
  for (const j of byPhone ?? []) {
    const id = j.assignedDriver?.id ?? '';
    if (!jobs.has(j.id) && (!id || id === driverId)) jobs.set(j.id, j);
  }
  return sortJobs([...jobs.values()]);
}

/** Live list of this driver's confirmed jobs; null + error when it cannot be read. Returns the unsubscribe. */
export function watchJobs(phone: string, driverId: string, onChange: Listener): () => void {
  const bookings = collection(firestore(), 'bookings');
  const { byId, byPhone } = myJobsQueries(phone, driverId);
  const lists: (Job[] | null | undefined)[] = [undefined, undefined];
  let lastError: unknown;
  // Told once both have answered, so a job never shows from one list and then jumps.
  const emit = () => {
    if (lists.some((l) => l === undefined)) return;
    const jobs = mergeJobs(lists[0], lists[1], driverId);
    onChange(jobs, jobs ? undefined : lastError);
  };
  const offs = [byId, byPhone].map((filters, i) =>
    onSnapshot(
      query(bookings, ...filters.map(([field, op, value]) => where(field, op, value))),
      (snap) => {
        lists[i] = snap.docs.map((d) => toJob(d.id, d.data()));
        emit();
      },
      (err) => {
        lists[i] = null;
        lastError = err;
        emit();
      },
    ),
  );
  return () => offs.forEach((off) => off());
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

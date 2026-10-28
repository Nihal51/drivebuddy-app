/**
 * The booking document: what the form collects, the exact fields written to
 * Firestore, and the shape read back for "My bookings".
 *
 * firestore.rules (website repo) accepts a new booking only with exactly the
 * fields in BOOKING_CREATE_KEYS — one extra or misspelt field and the save is
 * refused. booking.test.ts holds this file to that list.
 */

import {
  type BookingStatus,
  type City,
  type PackageId,
  isBookingStatus,
  isCity,
  isPackageId,
} from './catalog';
import {
  type BookingBill,
  type BookingClock,
  type BookingQuote,
  type BookingTrip,
  ELSEWHERE,
  TRIP_PACKAGES,
  isTripPackage,
  toBill,
  toClock,
  toQuote,
  toTrip,
} from './trip';
import {
  type FieldError,
  LIMITS,
  normalisePhone,
  validateChoice,
  validateDays,
  validateName,
  validateNotes,
  validatePhone,
  validatePickup,
  validatePlace,
} from './validate';

/** What the customer fills in. '' = not chosen yet; preferredTime '' = as soon as possible. */
export type BookingInput = {
  name: string;
  phone: string;
  city: City | '';
  packageId: PackageId | '';
  /** Outstation trip / one-way drop only: a destination id, ELSEWHERE, or ''. */
  destId: string;
  /** The place typed in when destId is ELSEWHERE. */
  destOther: string;
  /** Days with the driver; '' = as few as the distance allows. */
  days: string;
  pickup: string;
  preferredTime: string;
  notes: string;
};

export const EMPTY_BOOKING: BookingInput = {
  name: '',
  phone: '',
  city: '',
  packageId: '',
  destId: '',
  destOther: '',
  days: '',
  pickup: '',
  preferredTime: '',
  notes: '',
};

/** Form order — also the order the app scrolls to the first problem. */
export const BOOKING_FIELDS = [
  'name',
  'phone',
  'city',
  'packageId',
  'destId',
  'destOther',
  'days',
  'pickup',
  'preferredTime',
  'notes',
] as const;
export type BookingField = (typeof BOOKING_FIELDS)[number];
export type BookingErrors = Partial<Record<BookingField, FieldError>>;

export function validateBookingField(field: BookingField, input: BookingInput): FieldError | undefined {
  switch (field) {
    case 'name':
      return validateName(input.name);
    case 'phone':
      return validatePhone(input.phone);
    case 'city':
      return validateChoice(input.city);
    case 'packageId':
      return validateChoice(input.packageId);
    case 'destId':
      return isTripPackage(input.packageId) ? validateChoice(input.destId) : undefined;
    case 'destOther':
      return isTripPackage(input.packageId) && input.destId === ELSEWHERE
        ? validatePlace(input.destOther)
        : undefined;
    case 'days':
      return isTripPackage(input.packageId) ? validateDays(input.days) : undefined;
    case 'pickup':
      return validatePickup(input.pickup);
    case 'preferredTime':
      return input.preferredTime.length > LIMITS.preferredTime.max ? 'tooLong' : undefined;
    case 'notes':
      return validateNotes(input.notes);
  }
}

export function validateBooking(input: BookingInput): BookingErrors {
  const errors: BookingErrors = {};
  for (const field of BOOKING_FIELDS) {
    const e = validateBookingField(field, input);
    if (e) errors[field] = e;
  }
  return errors;
}

export const hasErrors = (errors: BookingErrors) => Object.values(errors).some(Boolean);

/** Every field firestore.rules allows on a new booking (createdAt is the server's clock). */
export const BOOKING_CREATE_KEYS = [
  'name',
  'phone',
  'city',
  'package',
  'pickup',
  'preferredTime',
  'notes',
  'createdAt',
  'status',
  'source',
  'customerUid',
  'trip',
] as const;

/** `source` on bookings made in this app; the website writes 'website'. */
export const APP_SOURCE = 'app';

export type NewBookingFields = {
  name: string;
  phone: string;
  city: City;
  package: PackageId;
  pickup: string;
  preferredTime: string;
  notes: string;
  status: 'new';
  source: typeof APP_SOURCE;
  customerUid?: string;
  /** Outstation trip / one-way drop only. */
  trip?: BookingTrip;
};

/**
 * A checked form → the fields to write (the caller adds createdAt as the
 * server timestamp). Throws if the input has not been validated, so an invalid
 * booking can never reach the network. `trip` (from planTrip + tripRecord) is
 * kept only on a trip package, and only if it matches the package's kind.
 */
export function newBookingFields(
  input: BookingInput,
  customerUid?: string | null,
  trip?: BookingTrip | null,
): NewBookingFields {
  if (hasErrors(validateBooking(input)) || !isCity(input.city) || !isPackageId(input.packageId)) {
    throw new Error('newBookingFields: the booking has not passed validateBooking');
  }
  const fields: NewBookingFields = {
    name: input.name.trim().replace(/\s+/g, ' '),
    phone: normalisePhone(input.phone),
    city: input.city,
    package: input.packageId,
    pickup: input.pickup.trim(),
    preferredTime: input.preferredTime.trim(),
    notes: input.notes.trim(),
    status: 'new',
    source: APP_SOURCE,
  };
  if (customerUid) fields.customerUid = customerUid;
  if (trip && isTripPackage(input.packageId) && trip.kind === TRIP_PACKAGES[input.packageId]) {
    fields.trip = { ...trip };
  }
  return fields;
}

/* ------------------------------------------------------------ read model */

export type DriverRef = { id: string; name: string; phone: string };

export type Booking = {
  id: string;
  name: string;
  phone: string;
  city: string;
  packageId: PackageId | null;
  /** The raw id, kept for a package this app version does not know yet. */
  packageRaw: string;
  pickup: string;
  preferredTime: string;
  notes: string;
  status: BookingStatus;
  source: string;
  createdAt?: Date;
  /** "DB-1042", given by the alerts robot within a minute of booking. */
  ref?: string;
  assignedDriver?: DriverRef;
  cancelReason?: string;
  updatedAt?: Date;
  /** Outstation trip / one-way drop: where, how long, and the estimate shown. */
  trip?: BookingTrip;
  /** The price agreed on the call, once the team has saved it. */
  quote?: BookingQuote;
  /** When the driver left, dropped the car and got home (his taps on the trip link). */
  clock?: BookingClock;
  /** The final bill from those times, once the team has saved it. */
  bill?: BookingBill;
};

/** Firestore Timestamp | Date | anything → Date | undefined, without importing the Firebase SDK here. */
export function toDate(v: unknown): Date | undefined {
  if (v instanceof Date) return v;
  if (typeof v === 'object' && v !== null && 'toDate' in v) {
    const fn = (v as { toDate: unknown }).toDate;
    if (typeof fn === 'function') return fn.call(v) as Date;
  }
  return undefined;
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');

function toDriver(v: unknown): DriverRef | undefined {
  if (typeof v !== 'object' || v === null) return undefined;
  const d = v as Record<string, unknown>;
  const ref = { id: str(d.id), name: str(d.name), phone: str(d.phone) };
  return ref.name && ref.phone ? ref : undefined;
}

/** A stored document → a Booking, tolerating missing or odd fields from older records. */
export function toBooking(id: string, data: Record<string, unknown>): Booking {
  const pkg = str(data.package);
  return {
    id,
    name: str(data.name),
    phone: str(data.phone),
    city: str(data.city),
    packageId: isPackageId(pkg) ? pkg : null,
    packageRaw: pkg,
    pickup: str(data.pickup),
    preferredTime: str(data.preferredTime),
    notes: str(data.notes),
    status: isBookingStatus(data.status) ? data.status : 'new',
    source: str(data.source),
    createdAt: toDate(data.createdAt),
    ref: str(data.ref) || undefined,
    assignedDriver: toDriver(data.assignedDriver),
    cancelReason: str(data.cancelReason) || undefined,
    updatedAt: toDate(data.updatedAt),
    trip: toTrip(data.trip),
    quote: toQuote(data.quote),
    clock: toClock(data.clock),
    bill: toBill(data.bill),
  };
}

/** Newest first; a booking still being written (no server time yet) counts as newest. */
export function sortNewestFirst(bookings: Booking[]): Booking[] {
  const t = (b: Booking) => b.createdAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
  return [...bookings].sort((a, b) => t(b) - t(a));
}

/** Upcoming/active bookings first in "My bookings": anything not finished. */
export const isActive = (b: Booking) => b.status !== 'completed' && b.status !== 'cancelled';

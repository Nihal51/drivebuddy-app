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
  type FieldError,
  LIMITS,
  normalisePhone,
  validateChoice,
  validateName,
  validateNotes,
  validatePhone,
  validatePickup,
} from './validate';

/** What the customer fills in. '' = not chosen yet; preferredTime '' = as soon as possible. */
export type BookingInput = {
  name: string;
  phone: string;
  city: City | '';
  packageId: PackageId | '';
  pickup: string;
  preferredTime: string;
  notes: string;
};

export const EMPTY_BOOKING: BookingInput = {
  name: '',
  phone: '',
  city: '',
  packageId: '',
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
};

/**
 * A checked form → the fields to write (the caller adds createdAt as the
 * server timestamp). Throws if the input has not been validated, so an invalid
 * booking can never reach the network.
 */
export function newBookingFields(input: BookingInput, customerUid?: string | null): NewBookingFields {
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
  };
}

/** Newest first; a booking still being written (no server time yet) counts as newest. */
export function sortNewestFirst(bookings: Booking[]): Booking[] {
  const t = (b: Booking) => b.createdAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
  return [...bookings].sort((a, b) => t(b) - t(a));
}

/** Upcoming/active bookings first in "My bookings": anything not finished. */
export const isActive = (b: Booking) => b.status !== 'completed' && b.status !== 'cancelled';

/**
 * The fixed vocabulary of the DriveBuddy backend: package ids, served cities and
 * booking statuses.
 *
 * These ids are what the website's firestore.rules accepts (Nihal51/very_new →
 * firestore.rules, `request.resource.data.package in [...]`). They never change
 * when a price changes — '1-hour-300' stays '1-hour-300' even at ₹350. Adding
 * one means editing firestore.rules, the website and the alerts robot too, or
 * bookings with the new id are refused. catalog.test.ts pins the list.
 */

export const PACKAGE_IDS = [
  '1-hour-300',
  '3-hours-600',
  'local-full-day',
  'outstation',
  'night-driver',
  'medical-emergency',
  'monthly-basic',
  'monthly-premium',
  'wedding-event',
  'one-way-drop',
] as const;

export type PackageId = (typeof PACKAGE_IDS)[number];

export const isPackageId = (v: unknown): v is PackageId =>
  typeof v === 'string' && (PACKAGE_IDS as readonly string[]).includes(v);

/** Grouping for the app's service list. */
export const PACKAGE_GROUPS: { id: 'hourly' | 'day' | 'monthly' | 'special'; packages: PackageId[] }[] = [
  { id: 'hourly', packages: ['1-hour-300', '3-hours-600'] },
  { id: 'day', packages: ['local-full-day', 'outstation', 'night-driver'] },
  { id: 'monthly', packages: ['monthly-basic', 'monthly-premium'] },
  { id: 'special', packages: ['medical-emergency', 'wedding-event', 'one-way-drop'] },
];

/** The package most customers pick; highlighted in the app. */
export const POPULAR_PACKAGE: PackageId = '3-hours-600';

export const CITIES = ['Raipur', 'Bhilai', 'Durg', 'Bilaspur'] as const;
export type City = (typeof CITIES)[number];
export const isCity = (v: unknown): v is City =>
  typeof v === 'string' && (CITIES as readonly string[]).includes(v);

/**
 * new → confirmed → assigned → completed, or cancelled at any point.
 * Only an admin (website /admin) moves a booking along; the app only reads.
 */
export const BOOKING_STATUSES = ['new', 'confirmed', 'assigned', 'completed', 'cancelled'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];
export const isBookingStatus = (v: unknown): v is BookingStatus =>
  typeof v === 'string' && (BOOKING_STATUSES as readonly string[]).includes(v);

/** The happy path, in order, for the progress tracker on a booking. */
export const STATUS_STEPS: readonly BookingStatus[] = ['new', 'confirmed', 'assigned', 'completed'];

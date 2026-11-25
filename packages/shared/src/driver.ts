/**
 * The driver on a booking, as the customer may see him (SPEC-privacy, 25 Nov
 * 2026: customers never get the driver's number, like Rapido), and the job
 * alerts that tell a driver about new work.
 *
 * - `assignedDriver` — { id, name }. Older bookings also carry his number
 *   until the robot's HIDE_DRIVER_PHONE switch removes it; no reader here
 *   keeps it, so no screen can show it.
 * - `driverConfirmed` — DriveBuddy has confirmed him on the job (the office's
 *   call, /admin, or the robot when calls are off).
 * - `driverCard` — robot-only: what the customer sees of him once confirmed
 *   (name, photo, rating, trips, experience, verified, since). No number, no
 *   address.
 * - `driverChangeRequest` — the customer's "Change driver" (at most twice per
 *   booking, before he taps Start); `driverChanges` and `changedDrivers` are
 *   the robot's count and list.
 * - `alertTests/{driverId}` and `drivers/{id}.lastAlert` — a test alert the
 *   driver asked for, and whether the last push reached his phone (robot).
 *
 * The robot and the website may be a version ahead or behind this app, so
 * every reader accepts a missing or odd field and leaves it out.
 */

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const count = (v: unknown) =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 1_000_000 ? v : 0;

/**
 * Firestore Timestamp | Date → Date. A field just written with
 * serverTimestamp() reads back as null until the server answers, so a
 * missing time never makes the whole field unreadable.
 */
function when(v: unknown): Date | undefined {
  if (v instanceof Date) return v;
  if (isObj(v) && typeof v.toDate === 'function') return (v.toDate as () => Date).call(v);
  return undefined;
}

/* ------------------------------------------------------------ the driver */

/** The driver on a booking: his driver id and name — never his number. */
export type DriverRef = { id: string; name: string };

/** A stored ref ({ id, name } or an older { id, name, phone }) → { id, name }; the number is dropped. */
export function toDriverRef(v: unknown): DriverRef | undefined {
  if (!isObj(v)) return undefined;
  const name = str(v.name).trim();
  return name ? { id: str(v.id), name } : undefined;
}

/** DriveBuddy confirmed this driver on the job (by: 'robot', 'telegram', 'admin', 'office'…). */
export type DriverConfirmed = { at?: Date; by: string; driverId: string };

export function toDriverConfirmed(v: unknown): DriverConfirmed | undefined {
  if (!isObj(v)) return undefined;
  const at = when(v.at);
  return { ...(at ? { at } : {}), by: str(v.by), driverId: str(v.driverId) };
}

/** What the customer sees of the driver once DriveBuddy has confirmed him (robot-written). */
export type DriverCard = {
  name: string;
  /** https only; null until drivers have photos (the apps show his initials). */
  photoUrl: string | null;
  /** The average of his ratings, 1 decimal; null until someone has rated him. */
  rating: number | null;
  ratingCount: number;
  /** Completed bookings. */
  trips: number;
  experienceYears: number | null;
  /** An approved, checked driver (Verified or Active in /admin): "Police verified". */
  verified: boolean;
  /** When DriveBuddy approved him; null if not known. */
  since: Date | null;
};

export function toDriverCard(v: unknown): DriverCard | undefined {
  if (!isObj(v)) return undefined;
  const name = str(v.name).trim();
  if (!name) return undefined;
  const photo = str(v.photoUrl);
  const rating = typeof v.rating === 'number' && v.rating >= 1 && v.rating <= 5 ? v.rating : null;
  const years =
    typeof v.experienceYears === 'number' &&
    Number.isInteger(v.experienceYears) &&
    v.experienceYears >= 0 &&
    v.experienceYears <= 60
      ? v.experienceYears
      : null;
  const ratingCount = count(v.ratingCount);
  return {
    name: name.slice(0, 60),
    photoUrl: /^https:\/\/\S+$/.test(photo) ? photo : null,
    // A rating with nobody behind it is not a rating.
    rating: ratingCount > 0 ? rating : null,
    ratingCount,
    trips: count(v.trips),
    experienceYears: years,
    verified: v.verified === true,
    since: when(v.since) ?? null,
  };
}

/** "Raju Sahu" → "RS", "raju" → "R": the card's picture until drivers have photos. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1] ?? '') : '';
  return (Array.from(first)[0] ?? '').concat(Array.from(last)[0] ?? '').toUpperCase();
}

/* --------------------------------------------------------- change driver */

/** "Change driver" at most this many times per booking (the rules and the robot agree). */
export const DRIVER_CHANGES_MAX = 2;

/** The customer's reason, optional, at most this long (firestore.rules isChangeRequest). */
export const CHANGE_REASON_MAX = 200;

/** Exactly the keys firestore.rules accepts on driverChangeRequest (at = the server's time). */
export const DRIVER_CHANGE_REQUEST_KEYS = ['at', 'reason'] as const;

/** The customer asked for another driver; the robot clears it once handled. at: absent until the server answers. */
export type DriverChangeRequest = { at?: Date; reason: string };

export function toDriverChangeRequest(v: unknown): DriverChangeRequest | undefined {
  if (!isObj(v)) return undefined;
  const at = when(v.at);
  return { ...(at ? { at } : {}), reason: str(v.reason) };
}

/** The robot's count of changes made (default 0). */
export const toDriverChanges = (v: unknown): number => count(v);

/** The drivers this booking was taken from (the robot's; ids only). */
export function toChangedDrivers(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x !== '') : [];
}

/** Changes the customer still has on this booking. */
export const driverChangesLeft = (b: { driverChanges?: number }): number =>
  Math.max(0, DRIVER_CHANGES_MAX - (b.driverChanges ?? 0));

/**
 * What the customer typed → the reason to save: trimmed and cut to the
 * rules' limit, by whole characters (never half an emoji), counting the way
 * both JavaScript and the rules can only agree with.
 */
export function changeReason(typed: string): string {
  let out = '';
  for (const ch of typed.trim()) {
    if (out.length + ch.length > CHANGE_REASON_MAX) break;
    out += ch;
  }
  return out.trim();
}

/* ------------------------------------------------------------ job alerts */

/**
 * What became of a push to a driver's phone (the robot, from Expo's ticket or
 * receipt): ok, or Expo's error — 'DeviceNotRegistered', 'InvalidCredentials'
 * …, or the robot's own 'NoToken' (no push token saved) and 'NoReceipt'.
 */
export type AlertResult = { at?: Date; ok: boolean; error: string | null };

export function toAlertResult(v: unknown): AlertResult | undefined {
  if (!isObj(v) || typeof v.ok !== 'boolean') return undefined;
  const at = when(v.at);
  const error = v.ok ? null : str(v.error) || 'PushError';
  return { ...(at ? { at } : {}), ok: v.ok, error };
}

/** alertTests/{driverId}: when he asked (absent until the server answers), and the result once Expo has. */
export type AlertTest = { at?: Date; result?: AlertResult };

export function toAlertTest(v: unknown): AlertTest | undefined {
  if (!isObj(v)) return undefined;
  const at = when(v.at);
  const result = toAlertResult(v.result);
  return { ...(at ? { at } : {}), ...(result ? { result } : {}) };
}

/**
 * Outstation trips and one-way car drops: the estimate the customer sees
 * before booking, the trip saved on the booking, and the price the team agreed
 * on the call (read back for "My bookings").
 *
 * The maths lives on the website (lib/outstation.ts in Nihal51/very_new). It
 * publishes, in /app-config.json, the rules and a table of destinations with
 * the km and the fewest days from each pickup city — so the app only looks
 * up and multiplies, and can never disagree with the website:
 *
 *     estimate = days × prices.outstation + return hours × outstation.returnHour
 *                                          (at most returnMaxPerDay in any 24 h)
 *
 * Each day covers the driver's 24 hours from the start, his bus/train home
 * included. Return hours are only those he is still travelling home after the
 * last paid day (start 6 AM, home 10 AM next day: 4 hours). The website works
 * them out per destination (they do not change with extra booked days).
 */

import { CITIES, type City, type PackageId } from './catalog';
import type { AppConfig, Range } from './config';

/* ----------------------------------------------------------------- rules */

export type TripKind = 'one-way' | 'round';

/** Packages that carry a trip, and which kind each is (firestore.rules: isTrip). */
export const TRIP_PACKAGES = {
  outstation: 'round',
  'one-way-drop': 'one-way',
} as const satisfies Partial<Record<PackageId, TripKind>>;
export type TripPackage = keyof typeof TRIP_PACKAGES;
export const isTripPackage = (id: unknown): id is TripPackage =>
  typeof id === 'string' && Object.prototype.hasOwnProperty.call(TRIP_PACKAGES, id);

/** site-settings.ts → outstation, as published (no costs, no profit). */
export type TripRules = {
  hoursPerDay: number;
  extraHour: number;
  /** Per hour the driver is still travelling home after the paid days. */
  returnHour: number;
  /** The most return hours cost in any 24 hours. */
  returnMaxPerDay: number;
  /** Per day, if the customer does not give the driver his meals. */
  mealAllowance: number;
  kmPerDay: number;
  localWithinKm: number;
};

export type CityLeg = { km: number; oneWay: { days: number; returnHours: number }; roundDays: number };

export type TripDestination = {
  /** Stable id, saved on bookings. */
  id: string;
  name: string;
  nameHi: string;
  region: 'cg' | 'india';
  from: Record<City, CityLeg>;
};

/** The picker's value for a place that is not in the list. */
export const ELSEWHERE = 'other';

/** Shown first, before the customer types anything. */
export const POPULAR_DESTINATIONS = [
  'bilaspur',
  'nagpur',
  'jagdalpur',
  'raigarh',
  'korba',
  'ambikapur',
  'jabalpur',
  'bhubaneswar',
  'hyderabad',
  'kolkata',
  'delhi',
  'mumbai',
] as const;

/** Destinations whose English or Hindi name contains the search, best matches first. */
export function searchDestinations(all: readonly TripDestination[], search: string): TripDestination[] {
  const q = search.trim().toLowerCase();
  if (!q) {
    const byId = new Map(all.map((d) => [d.id, d]));
    return POPULAR_DESTINATIONS.map((id) => byId.get(id)).filter((d): d is TripDestination => Boolean(d));
  }
  const score = (d: TripDestination) => {
    const en = d.name.toLowerCase();
    if (en.startsWith(q) || d.nameHi.startsWith(q)) return 0;
    if (en.includes(q) || d.nameHi.includes(q)) return 1;
    return 2;
  };
  return all
    .map((d) => ({ d, s: score(d) }))
    .filter((x) => x.s < 2)
    .sort((a, b) => a.s - b.s || a.d.name.localeCompare(b.d.name))
    .map((x) => x.d);
}

/* ------------------------------------------------------------------ plan */

export type TripEstimate = { from: number; to: number; driving: Range; returnCharge: number };

/** What `hours` of return travel cost at `rate` an hour, at most `maxPerDay` in any 24 hours (as on the website). */
export function returnCost(hours: number, rate: number, maxPerDay: number): number {
  const h = Math.max(0, Math.round(hours));
  const fullDays = Math.floor(h / 24);
  return fullDays * Math.min(24 * rate, maxPerDay) + Math.min((h - 24 * fullDays) * rate, maxPerDay);
}

export type TripPlan = {
  kind: TripKind;
  /** Undefined for "somewhere else". */
  dest?: TripDestination;
  /** One-way km from the pickup city; 0 when unknown. */
  km: number;
  /** The fewest days the distance allows (1 when unknown). */
  minDays: number;
  /** The days charged. */
  days: number;
  /** One-way: hours the driver is still travelling home after the paid days. */
  returnHours: number;
  /** Closer than localWithinKm: a local package is usually cheaper. */
  local: boolean;
  /** The pickup city itself was picked. */
  sameCity: boolean;
  est?: TripEstimate;
};

const MAX_DAYS = 60;

/**
 * The trip for the form. `bookedDays` is what the customer chose (0 = as few
 * as the distance allows); never fewer than the distance needs.
 */
export function planTrip(
  config: AppConfig,
  pkg: TripPackage,
  city: City | '',
  destId: string,
  bookedDays = 0,
): TripPlan {
  const kind = TRIP_PACKAGES[pkg];
  const dest = destId && destId !== ELSEWHERE ? config.destinations.find((d) => d.id === destId) : undefined;
  const booked = Math.floor(bookedDays) || 0;
  const leg = dest && city ? dest.from[city] : undefined;
  const sameCity = Boolean(dest && leg && leg.km === 0);
  if (!dest || !leg || sameCity) {
    const days = Math.min(MAX_DAYS, Math.max(1, booked));
    return { kind, dest, km: 0, minDays: 1, days, returnHours: 0, local: false, sameCity };
  }
  const minDays = kind === 'round' ? leg.roundDays : leg.oneWay.days;
  const days = Math.min(MAX_DAYS, Math.max(minDays, booked));
  const returnHours = kind === 'one-way' ? leg.oneWay.returnHours : 0;
  const rate = config.prices.outstation;
  const driving = { from: days * rate.from, to: days * rate.to };
  const { returnHour, returnMaxPerDay } = config.outstation;
  const returnCharge = returnCost(returnHours, returnHour, returnMaxPerDay);
  return {
    kind,
    dest,
    km: leg.km,
    minDays,
    days,
    returnHours,
    local: leg.km < config.outstation.localWithinKm,
    sameCity,
    est: { from: driving.from + returnCharge, to: driving.to + returnCharge, driving, returnCharge },
  };
}

/* ------------------------------------------------------ saved on booking */

/** The trip on a booking — exactly the keys firestore.rules `isTrip` accepts. */
export type BookingTrip = {
  to: string;
  destId: string;
  kind: TripKind;
  km: number;
  days: number;
  /** One-way: hours the driver is still travelling home after the paid days. */
  returnHours: number;
  estFrom: number;
  estTo: number;
};

export const TRIP_KEYS = ['to', 'destId', 'kind', 'km', 'days', 'returnHours', 'estFrom', 'estTo'] as const;

export function tripRecord(plan: TripPlan, typedPlace: string): BookingTrip {
  return {
    to: plan.dest ? plan.dest.name : typedPlace.trim().replace(/\s+/g, ' '),
    destId: plan.dest?.id ?? '',
    kind: plan.kind,
    km: plan.km,
    days: plan.days,
    returnHours: plan.returnHours,
    estFrom: plan.est?.from ?? 0,
    estTo: plan.est?.to ?? 0,
  };
}

/** The price agreed on the call (firestore.rules `isQuote`): only what the customer pays. */
export type BookingQuote = {
  amount: number;
  dayRate: number;
  days: number;
  /** Return hours after the paid days, the rate, and the charge with the daily maximum applied. */
  returnHours: number;
  returnHourRate: number;
  returnCharge: number;
  extraHours: number;
  extraHourRate: number;
  ticket: number;
};

/** 2450 → "2,450" (Indian grouping; local copy so trip.ts needs nothing from prices.ts). */
function digits(n: number): string {
  const s = String(Math.round(Math.abs(n)));
  return s.length <= 3 ? s : `${s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${s.slice(-3)}`;
}

/**
 * The trip in one English line for the team (the same words as the alerts
 * robot): "Trip: Raipur → Delhi · one-way drop · ~1214 km · 3 days + 9 h
 * getting home · est. ₹5,430–6,030".
 */
export function tripNote(t: BookingTrip, city: string): string {
  const n = (k: number, word: string) => `${k} ${word}${k === 1 ? '' : 's'}`;
  return [
    `Trip: ${city} → ${t.to}${t.destId ? '' : ' (not in our list)'}`,
    t.kind === 'round' ? 'round trip' : 'one-way drop',
    t.km > 0 ? `~${t.km} km` : null,
    n(t.days, 'day') + (t.kind !== 'round' && t.returnHours > 0 ? ` + ${t.returnHours} h getting home` : ''),
    t.estFrom > 0
      ? `est. ₹${digits(t.estFrom)}${t.estTo > t.estFrom ? `–${digits(t.estTo)}` : ''}`
      : 'quote on the call',
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * The notes with the trip written at the top, within the 500 characters
 * firestore.rules allows — for a website that does not take `trip` yet.
 */
export function notesWithTrip(notes: string, t: BookingTrip, city: string, max = 500): string {
  const line = tripNote(t, city);
  const rest = notes.trim();
  return (rest ? `${line}\n${rest}` : line).slice(0, max);
}

/* --------------------------------------------------------- read back ---- */

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const int = (v: unknown, max = 10_000_000) =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max ? v : null;

/** A stored trip → BookingTrip, or undefined if it is missing or odd. */
export function toTrip(v: unknown): BookingTrip | undefined {
  if (!isObj(v) || typeof v.to !== 'string' || !v.to.trim()) return undefined;
  const nums = [int(v.km), int(v.days, 366), int(v.returnHours, 1000), int(v.estFrom), int(v.estTo)];
  if (nums.some((n) => n === null)) return undefined;
  const [km, days, returnHours, estFrom, estTo] = nums as number[];
  return {
    to: v.to,
    destId: typeof v.destId === 'string' ? v.destId : '',
    kind: v.kind === 'round' ? 'round' : 'one-way',
    km: km as number,
    days: Math.max(1, days as number),
    returnHours: returnHours as number,
    estFrom: estFrom as number,
    estTo: Math.max(estFrom as number, estTo as number),
  };
}

/** A stored quote → BookingQuote, or undefined. */
export function toQuote(v: unknown): BookingQuote | undefined {
  if (!isObj(v)) return undefined;
  const keys = [
    'amount',
    'dayRate',
    'days',
    'returnHours',
    'returnHourRate',
    'returnCharge',
    'extraHours',
    'extraHourRate',
    'ticket',
  ] as const;
  const out = {} as BookingQuote;
  for (const k of keys) {
    const n = int(v[k]);
    if (n === null) return undefined;
    out[k] = n;
  }
  return out.amount > 0 ? out : undefined;
}

/* ------------------------------------------------------- config checks -- */

const isPositive = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 1_000_000;

export function parseTripRules(v: unknown): TripRules | null {
  if (!isObj(v)) return null;
  const keys = [
    'hoursPerDay',
    'extraHour',
    'returnHour',
    'returnMaxPerDay',
    'mealAllowance',
    'kmPerDay',
    'localWithinKm',
  ] as const;
  if (!keys.every((k) => isPositive(v[k]))) return null;
  return {
    hoursPerDay: v.hoursPerDay as number,
    extraHour: v.extraHour as number,
    returnHour: v.returnHour as number,
    returnMaxPerDay: v.returnMaxPerDay as number,
    mealAllowance: v.mealAllowance as number,
    kmPerDay: v.kmPerDay as number,
    localWithinKm: v.localWithinKm as number,
  };
}

function parseLeg(v: unknown): CityLeg | null {
  if (!isObj(v) || !isObj(v.oneWay)) return null;
  const km = int(v.km, 10_000);
  const days = int(v.oneWay.days, 366);
  const back = int(v.oneWay.returnHours, 1000);
  const round = int(v.roundDays, 366);
  if (km === null || !days || back === null || !round) return null;
  return { km, oneWay: { days, returnHours: back }, roundDays: round };
}

/** The published destinations table, rebuilt field by field; null if any row is wrong. */
export function parseDestinations(v: unknown): TripDestination[] | null {
  if (!Array.isArray(v) || v.length === 0 || v.length > 500) return null;
  const out: TripDestination[] = [];
  for (const row of v) {
    if (!isObj(row) || !isObj(row.from)) return null;
    const { id, name, nameHi, region } = row;
    if (typeof id !== 'string' || !/^[a-z]{1,30}$/.test(id)) return null;
    if (typeof name !== 'string' || !name.trim() || name.length > 60) return null;
    if (typeof nameHi !== 'string' || nameHi.length > 60) return null;
    if (region !== 'cg' && region !== 'india') return null;
    const from = {} as Record<City, CityLeg>;
    for (const city of CITIES) {
      const leg = parseLeg(row.from[city]);
      if (!leg) return null;
      from[city] = leg;
    }
    out.push({ id, name, nameHi: nameHi || name, region, from });
  }
  return out;
}

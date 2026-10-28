/**
 * Outstation trips and one-way car drops: the estimate the customer sees
 * before booking, the trip saved on the booking, and the price the team agreed
 * on the call (read back for "My bookings").
 *
 * The maths lives on the website (lib/outstation.ts in Nihal51/very_new). It
 * publishes, in /app-config.json, the rules and a table of destinations with
 * the km, the hours of driving and the average way home from each pickup
 * city, and the regular trains home with their running days — so the app
 * repeats the website's planTrip for the customer's own start and can never
 * disagree with it (one-way drops):
 *
 *     estimate = full days × prices.outstation       each hoursPerDay (12 h) of driving
 *              + extra hours × outstation.extraHour  the driving left over (a shorter drive: all of it)
 *              + way home × outstation.returnHour    from the drop until he is home, waiting included
 *                                                    (at most returnMaxPerDay in any 24 h)
 *
 * The start date and time decide when he drops the car (12 h of driving and
 * 12 of rest, or day and night) and which train he catches. Round trips: the
 * days of the trip.
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
  /** Driving hours in a day; each is a full day at prices.outstation. */
  hoursPerDay: number;
  /** Per driving hour beyond the full days (or of a drive shorter than a day). */
  extraHour: number;
  /** Per hour of the driver's way home, from the drop until he is home. */
  returnHour: number;
  /** The most the way home costs in any 24 hours. */
  returnMaxPerDay: number;
  /** From the drop to the station, hours (older website files lack it: 1). */
  stationHours?: number;
  /** Highway average with stops, km/h (older website files lack it: 50). */
  averageKmh?: number;
  /** Per day, if the customer does not give the driver his meals. */
  mealAllowance: number;
  kmPerDay: number;
  localWithinKm: number;
};

export type CityLeg = {
  km: number;
  oneWay: {
    /** Calendar days of driving, for a 7 AM start. */
    days: number;
    /** Hours from the drop until he is home, for a 7 AM start on an unknown day. */
    returnHours: number;
    /** Hours of driving in all. */
    driveHours?: number;
    /** The average way home to this pickup city, hours on board. */
    homeHours?: number;
  };
  roundDays: number;
};

/**
 * A regular train home: departure (India time, "HH:MM") and hours to Raipur.
 * `days`: the weekdays it leaves (0 = Sunday … 6 = Saturday), left out =
 * daily; `via`: a change of train on the way.
 */
export type HomeTrain = {
  no: string;
  name: string;
  dep: string;
  hours: number;
  days?: number[];
  via?: string;
};

export type TripDestination = {
  /** Stable id, saved on bookings. */
  id: string;
  name: string;
  nameHi: string;
  region: 'cg' | 'india';
  /** Long routes with few trains a day: the regular ones home. */
  trains?: HomeTrain[];
  from: Record<City, CityLeg>;
};

/** When the customer has not picked a time, the estimate assumes the driver leaves at 7 AM (as the website). */
export const DEFAULT_START_HOUR = 7;

/** The picker's value for a place that is not in the list. */
export const ELSEWHERE = 'other';

/**
 * Shown first, before the customer types anything (the app shows the first
 * eight): the nearby towns people go to most, then the big cities drops go to.
 */
export const POPULAR_DESTINATIONS = [
  'bilaspur',
  'nagpur',
  'raigarh',
  'jagdalpur',
  'hyderabad',
  'kolkata',
  'mumbai',
  'delhi',
  'korba',
  'ambikapur',
  'jabalpur',
  'bhubaneswar',
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

export type TripEstimate = {
  from: number;
  to: number;
  /** The full days at the day rate, plus the extra driving hours. */
  driving: Range;
  /** The extra driving hours alone. */
  extraCharge: number;
  /** The way home (one-way). */
  returnCharge: number;
};

/** What `hours` cost at `rate` an hour, at most `maxPerDay` in any 24 hours (as on the website). */
export function returnCost(hours: number, rate: number, maxPerDay: number): number {
  const h = Math.max(0, Math.round(Number.isFinite(hours) ? hours : 0));
  const fullDays = Math.floor(h / 24);
  return fullDays * Math.min(24 * rate, maxPerDay) + Math.min((h - 24 * fullDays) * rate, maxPerDay);
}

export type TripPlan = {
  kind: TripKind;
  /** Undefined for "somewhere else". */
  dest?: TripDestination;
  /** One-way km from the pickup city; 0 when unknown. */
  km: number;
  /** The fewest calendar days (1 when unknown). */
  minDays: number;
  /** Calendar days of the trip. */
  days: number;
  /** At the day rate: one-way, each full hoursPerDay of driving (or the days booked); round trips, the days. */
  fullDays: number;
  /** One-way: driving hours beyond the full days (or of a shorter drive). */
  extraHours: number;
  /** One-way: hours of driving in all. */
  driveHours: number;
  /** One-way: day and night, without the night's rest. */
  nonstop: boolean;
  /** One-way: whole hours from the drop until he is home, the waiting included. */
  returnHours: number;
  /** The start: hour of the day and, if known, the weekday (0 = Sunday). */
  startHour: number;
  weekday?: number;
  /** One-way, when the table has the timings: hours after the start he drops the car, leaves and is home. */
  dropAt?: number;
  leaveAt?: number;
  homeAt?: number;
  /** The regular train he catches, on routes with a timetable. */
  train?: HomeTrain;
  /** Closer than localWithinKm: a local package is usually cheaper. */
  local: boolean;
  /** The pickup city itself was picked. */
  sameCity: boolean;
  est?: TripEstimate;
};

/** When the driver leaves: the hour of the day and, if the date is known, the weekday. */
export type TripStart = { hour: number; weekday?: number };

const MAX_DAYS = 60;

/** "21:35" → 21.583… (hour of the day). */
const clock = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) + (m || 0) / 60;
};

/** "2026-11-03T09:30" (the stored preferred time) → 9.5; '' or odd → undefined. */
export function startHourOf(preferredTime: string): number | undefined {
  const m = /T(\d{2}):(\d{2})/.exec(preferredTime ?? '');
  if (!m) return undefined;
  const h = Number(m[1]) + Number(m[2]) / 60;
  return h >= 0 && h < 24 ? h : undefined;
}

/**
 * When he drops the car, hours after the start (as lib/outstation.ts
 * dropTime): day and night straight through; otherwise hoursPerDay of driving
 * and the rest of the 24 hours resting, up to an hour more finishing that
 * evening. `extraDays`: stops on the way the customer booked.
 */
export function dropTime(hoursPerDay: number, hours: number, nonstop = false, extraDays = 0): number {
  if (nonstop) return hours + extraDays * 24;
  const full = Math.floor(hours / hoursPerDay + 1e-9);
  const rest = hours - full * hoursPerDay;
  let at: number;
  if (full === 0) at = hours;
  else if (rest <= 1e-9) at = (full - 1) * 24 + hoursPerDay;
  else if (rest <= 1 + 1e-9) at = (full - 1) * 24 + hoursPerDay + rest;
  else at = full * 24 + rest;
  return at + extraDays * 24;
}

/** The first time a train leaves at or after `ready`, on a day it runs; an unknown weekday counts only daily trains. */
function nextDeparture(t: HomeTrain, ready: number, start: TripStart): number | undefined {
  let at = ready + ((((clock(t.dep) - (start.hour + ready)) % 24) + 24) % 24);
  if (!t.days || t.days.length === 0) return at;
  if (start.weekday === undefined) return undefined;
  for (let i = 0; i < 8; i++, at += 24) {
    const weekday = (start.weekday + Math.floor((start.hour + at) / 24 + 1e-9)) % 7;
    if (t.days.includes(weekday)) return at;
  }
  return undefined;
}

/**
 * The trip for the form, exactly as the website's planTrip. `bookedDays` is
 * what the customer chose (0 = as few as the distance allows); `start` the
 * hour the driver leaves (and the weekday, if the date is known); `nonstop`
 * day and night (one-way).
 */
export function planTrip(
  config: AppConfig,
  pkg: TripPackage,
  city: City | '',
  destId: string,
  bookedDays = 0,
  start: TripStart | number = DEFAULT_START_HOUR,
  nonstop = false,
): TripPlan {
  const kind = TRIP_PACKAGES[pkg];
  const raw = typeof start === 'number' ? { hour: start } : start;
  const hour = Number.isFinite(raw.hour) ? ((raw.hour % 24) + 24) % 24 : DEFAULT_START_HOUR;
  const weekday =
    raw.weekday !== undefined && Number.isInteger(raw.weekday) && raw.weekday >= 0 && raw.weekday <= 6
      ? raw.weekday
      : undefined;
  const at: TripStart = weekday === undefined ? { hour } : { hour, weekday };
  const dest = destId && destId !== ELSEWHERE ? config.destinations.find((d) => d.id === destId) : undefined;
  const booked = Math.min(MAX_DAYS, Math.max(0, Math.floor(bookedDays) || 0));
  const leg = dest && city ? dest.from[city] : undefined;
  const sameCity = Boolean(dest && leg && leg.km === 0);
  const base = { kind, dest, startHour: hour, ...(weekday !== undefined && { weekday }), sameCity };
  const none = { fullDays: 0, extraHours: 0, driveHours: 0, nonstop: false, returnHours: 0 };
  if (!dest || !leg || sameCity) {
    const days = Math.max(1, booked);
    return { ...base, ...none, km: 0, minDays: 1, days, fullDays: days, local: false };
  }
  const rules = config.outstation;
  const rate = config.prices.outstation;
  const local = leg.km < rules.localWithinKm;

  if (kind === 'round') {
    const days = Math.max(leg.roundDays, booked);
    const driving = { from: days * rate.from, to: days * rate.to };
    return {
      ...base,
      ...none,
      km: leg.km,
      minDays: leg.roundDays,
      days,
      fullDays: days,
      local,
      est: { from: driving.from, to: driving.to, driving, extraCharge: 0, returnCharge: 0 },
    };
  }

  // Driving: each hoursPerDay is a day, the rest by the hour.
  const straight = nonstop;
  const hours = leg.oneWay.driveHours ?? leg.km / (rules.averageKmh ?? 50);
  const full = Math.floor(hours / rules.hoursPerDay + 1e-9);
  const rest = hours - full * rules.hoursPerDay;
  const leftover = rest > 1e-9 ? Math.ceil(rest - 1e-9) : 0;
  const lastDayAt = dropTime(rules.hoursPerDay, hours, straight);
  const calendar = straight
    ? Math.max(1, Math.ceil((lastDayAt - 1e-9) / 24))
    : full + (rest > 1 + 1e-9 || full === 0 ? 1 : 0);
  const extraDays = booked > calendar ? booked - calendar : 0;
  const fullDays = extraDays > 0 ? booked : full;
  const extraHours = extraDays > 0 ? 0 : leftover;

  // The way home: the station, then the train or bus that gets him home soonest.
  let timing: Pick<TripPlan, 'returnHours' | 'dropAt' | 'leaveAt' | 'homeAt' | 'train'> = {
    returnHours: leg.oneWay.returnHours,
  };
  const homeHours = leg.oneWay.homeHours;
  if (homeHours !== undefined && leg.oneWay.driveHours !== undefined) {
    const dropAt = lastDayAt + (straight ? 0 : extraDays * 24);
    const ready = dropAt + (rules.stationHours ?? 1);
    let leaveAt = ready;
    let homeAt = ready + homeHours;
    let train: HomeTrain | undefined;
    const offset = homeHours - (dest.from.Raipur.oneWay.homeHours ?? homeHours);
    for (const t of dest.trains ?? []) {
      const leaves = nextDeparture(t, ready, at);
      if (leaves === undefined) continue;
      const arrives = leaves + t.hours + offset;
      if (!train || arrives < homeAt) {
        train = t;
        leaveAt = leaves;
        homeAt = arrives;
      }
    }
    timing = {
      returnHours: Math.max(0, Math.ceil(homeAt - dropAt - 1e-9)),
      dropAt,
      leaveAt,
      homeAt,
      ...(train && { train }),
    };
  }

  const extraCharge = extraHours * rules.extraHour;
  const driving = { from: fullDays * rate.from + extraCharge, to: fullDays * rate.to + extraCharge };
  const returnCharge = returnCost(timing.returnHours, rules.returnHour, rules.returnMaxPerDay);
  return {
    ...base,
    km: leg.km,
    minDays: calendar,
    days: calendar + extraDays,
    fullDays,
    extraHours,
    driveHours: hours,
    nonstop: straight,
    ...timing,
    local,
    est: {
      from: driving.from + returnCharge,
      to: driving.to + returnCharge,
      driving,
      extraCharge,
      returnCharge,
    },
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
  /** One-way: hours from the drop until he is home, the waiting included. */
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
  /** Hours from the drop until he was home, the hourly rate, and the charge with the daily maximum. */
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
 * robot): "Trip: Raipur → Delhi · one-way drop · ~1214 km · 2 days + 38 h
 * getting home · est. ₹5,620–5,820".
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
  const station = v.stationHours;
  const kmh = v.averageKmh;
  return {
    ...(typeof station === 'number' &&
      Number.isFinite(station) &&
      station >= 0 &&
      station <= 12 && { stationHours: station }),
    ...(typeof kmh === 'number' && Number.isFinite(kmh) && kmh >= 20 && kmh <= 120 && { averageKmh: kmh }),
    hoursPerDay: v.hoursPerDay as number,
    extraHour: v.extraHour as number,
    returnHour: v.returnHour as number,
    returnMaxPerDay: v.returnMaxPerDay as number,
    mealAllowance: v.mealAllowance as number,
    kmPerDay: v.kmPerDay as number,
    localWithinKm: v.localWithinKm as number,
  };
}

const hours = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100 ? v : undefined;

function parseLeg(v: unknown): CityLeg | null {
  if (!isObj(v) || !isObj(v.oneWay)) return null;
  const km = int(v.km, 10_000);
  const days = int(v.oneWay.days, 366);
  const back = int(v.oneWay.returnHours, 1000);
  const round = int(v.roundDays, 366);
  if (km === null || !days || back === null || !round) return null;
  const driveHours = hours(v.oneWay.driveHours);
  const homeHours = hours(v.oneWay.homeHours);
  // The timings only count together; one alone is ignored.
  const timed = driveHours !== undefined && homeHours !== undefined ? { driveHours, homeHours } : {};
  return { km, oneWay: { days, returnHours: back, ...timed }, roundDays: round };
}

/** The regular trains home; any odd row drops the whole list (the estimate then uses the average). */
function parseTrains(v: unknown): HomeTrain[] | undefined {
  if (!Array.isArray(v) || v.length === 0 || v.length > 20) return undefined;
  const out: HomeTrain[] = [];
  for (const t of v) {
    if (!isObj(t)) return undefined;
    const { no, name, dep } = t;
    const h = hours(t.hours);
    if (typeof no !== 'string' || !/^\d{4,5}$/.test(no)) return undefined;
    if (typeof name !== 'string' || !name.trim() || name.length > 60) return undefined;
    if (typeof dep !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(dep) || !h) return undefined;
    const days = t.days;
    if (
      days !== undefined &&
      (!Array.isArray(days) || days.length > 7 || !days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6))
    )
      return undefined;
    const via = t.via;
    if (via !== undefined && (typeof via !== 'string' || !via.trim() || via.length > 40)) return undefined;
    out.push({
      no,
      name,
      dep,
      hours: h,
      ...(Array.isArray(days) && days.length > 0 && { days: days as number[] }),
      ...(typeof via === 'string' && { via }),
    });
  }
  return out;
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
    const trains = parseTrains(row.trains);
    out.push({ id, name, nameHi: nameHi || name, region, ...(trains && { trains }), from });
  }
  return out;
}

/**
 * Outstation trips and one-way car drops: the estimate the customer sees
 * before booking, the trip saved on the booking, and the price the team agreed
 * on the call (read back for "My bookings").
 *
 * The maths lives on the website (lib/outstation.ts in Nihal51/very_new). It
 * publishes, in /app-config.json, the rules and a table of destinations with
 * the km and the fewest days from each pickup city, the driving hours on the
 * last day, the average way home and the regular trains home — so the app
 * repeats only the website's last step and can never disagree with it:
 *
 *     estimate = driving days × prices.outstation
 *              + one return day (returnMaxPerDay) if the driver is not home when the driving days end
 *              + returnHour per late hour after the return day (at most returnMaxPerDay in any 24 h)
 *
 * A driving day is a driving day, the trip home is its own day (Raipur →
 * Mumbai: 2 driving days + 1 return day). The start time decides when he
 * drops the car and which train he catches, so it changes the estimate.
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
  /** Per late hour: still travelling home after the return day. */
  returnHour: number;
  /** The return day — and the most late hours cost in any 24 hours. */
  returnMaxPerDay: number;
  /** From the drop to the station, hours (website files before 28 Oct 2026 lack it: 1). */
  stationHours?: number;
  /** Per day, if the customer does not give the driver his meals. */
  mealAllowance: number;
  kmPerDay: number;
  localWithinKm: number;
};

export type CityLeg = {
  km: number;
  oneWay: {
    days: number;
    /** Hours after the driving days until he is home, for a 7 AM start (any = a return day). */
    returnHours: number;
    /** Hours of driving on the last day. */
    lastDayHours?: number;
    /** The average way home to this pickup city, hours on board. */
    homeHours?: number;
  };
  roundDays: number;
};

/** A regular train home: departure (India time, "HH:MM") and hours on board to Raipur. */
export type HomeTrain = { no: string; name: string; dep: string; hours: number };

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
  driving: Range;
  /** Return day + late hours. */
  returnCharge: number;
  /** The return day alone (0 if none). */
  returnDayCharge: number;
  /** Late hours after the return day. */
  lateCharge: number;
};

/** What `hours` cost at `rate` an hour, at most `maxPerDay` in any 24 hours (as on the website). */
export function returnCost(hours: number, rate: number, maxPerDay: number): number {
  const h = Math.max(0, Math.round(hours));
  const fullDays = Math.floor(h / 24);
  return fullDays * Math.min(24 * rate, maxPerDay) + Math.min((h - 24 * fullDays) * rate, maxPerDay);
}

/**
 * The way home for `hours` after the driving days (as on the website): nothing
 * if 0; else one return day (`dayPrice`) and, after its 24 hours, `rate` per
 * late hour, at most `dayPrice` in any 24 hours.
 */
export function returnDayCost(hours: number, rate: number, dayPrice: number): number {
  const h = Math.max(0, Math.round(Number.isFinite(hours) ? hours : 0));
  return h > 0 ? dayPrice + returnCost(Math.max(0, h - 24), rate, dayPrice) : 0;
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
  /** One-way: whole hours after the driving days until he is home (0 = in time). */
  returnHours: number;
  /** One-way: not home when the driving days end, so a return day is charged. */
  returnDay: boolean;
  /** One-way: hours still travelling after the return day. */
  lateHours: number;
  /** The start used, as an hour of the day (7.5 = 7:30 AM). */
  startHour: number;
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
 * The trip for the form. `bookedDays` is what the customer chose (0 = as few
 * as the distance allows); never fewer than the distance needs. `startHour`:
 * when the driver leaves (hour of the day) — on a one-way drop it decides
 * which train he catches home, exactly as lib/outstation.ts planTrip does.
 */
export function planTrip(
  config: AppConfig,
  pkg: TripPackage,
  city: City | '',
  destId: string,
  bookedDays = 0,
  startHour: number = DEFAULT_START_HOUR,
): TripPlan {
  const kind = TRIP_PACKAGES[pkg];
  const start = Number.isFinite(startHour) ? ((startHour % 24) + 24) % 24 : DEFAULT_START_HOUR;
  const dest = destId && destId !== ELSEWHERE ? config.destinations.find((d) => d.id === destId) : undefined;
  const booked = Math.floor(bookedDays) || 0;
  const leg = dest && city ? dest.from[city] : undefined;
  const sameCity = Boolean(dest && leg && leg.km === 0);
  const none = { returnHours: 0, returnDay: false, lateHours: 0, startHour: start };
  if (!dest || !leg || sameCity) {
    const days = Math.min(MAX_DAYS, Math.max(1, booked));
    return { kind, dest, km: 0, minDays: 1, days, local: false, sameCity, ...none };
  }
  const minDays = kind === 'round' ? leg.roundDays : leg.oneWay.days;
  const days = Math.min(MAX_DAYS, Math.max(minDays, booked));

  let timing: Pick<TripPlan, 'returnHours' | 'dropAt' | 'leaveAt' | 'homeAt' | 'train'> = { returnHours: 0 };
  if (kind === 'one-way') {
    const { lastDayHours, homeHours } = leg.oneWay;
    if (lastDayHours === undefined || homeHours === undefined) {
      // An older website file: its table's figure (for a 7 AM start).
      timing = { returnHours: leg.oneWay.returnHours };
    } else {
      const dropAt = (days - 1) * 24 + lastDayHours;
      const ready = dropAt + (config.outstation.stationHours ?? 1);
      let leaveAt = ready;
      let homeAt = ready + homeHours;
      let train: HomeTrain | undefined;
      const offset = homeHours - (dest.from.Raipur.oneWay.homeHours ?? homeHours);
      for (const t of dest.trains ?? []) {
        const wait = (((clock(t.dep) - (start + ready)) % 24) + 24) % 24;
        const arrives = ready + wait + t.hours + offset;
        if (!train || arrives < homeAt) {
          train = t;
          leaveAt = ready + wait;
          homeAt = arrives;
        }
      }
      timing = {
        returnHours: Math.max(0, Math.ceil(homeAt - days * 24 - 1e-9)),
        dropAt,
        leaveAt,
        homeAt,
        ...(train && { train }),
      };
    }
  }

  const rate = config.prices.outstation;
  const driving = { from: days * rate.from, to: days * rate.to };
  const { returnHour, returnMaxPerDay } = config.outstation;
  const returnCharge = returnDayCost(timing.returnHours, returnHour, returnMaxPerDay);
  const returnDayCharge = timing.returnHours > 0 ? returnMaxPerDay : 0;
  return {
    kind,
    dest,
    km: leg.km,
    minDays,
    days,
    ...timing,
    returnDay: timing.returnHours > 0,
    lateHours: Math.max(0, timing.returnHours - 24),
    startHour: start,
    local: leg.km < config.outstation.localWithinKm,
    sameCity,
    est: {
      from: driving.from + returnCharge,
      to: driving.to + returnCharge,
      driving,
      returnCharge,
      returnDayCharge,
      lateCharge: returnCharge - returnDayCharge,
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
  /** One-way: hours after the driving days until he is home (any = a return day; past 24 = late hours). */
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
  /** Hours after the driving days until he was home, the late-hour rate, and the return day + late hours. */
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
 * robot): "Trip: Raipur → Delhi · one-way drop · ~1214 km · 2 days + a return
 * day · est. ₹4,300–4,500".
 */
export function tripNote(t: BookingTrip, city: string): string {
  const n = (k: number, word: string) => `${k} ${word}${k === 1 ? '' : 's'}`;
  return [
    `Trip: ${city} → ${t.to}${t.destId ? '' : ' (not in our list)'}`,
    t.kind === 'round' ? 'round trip' : 'one-way drop',
    t.km > 0 ? `~${t.km} km` : null,
    n(t.days, 'day') +
      (t.kind !== 'round' && t.returnHours > 0
        ? ` + a return day${t.returnHours > 24 ? ` + ${t.returnHours - 24} late h` : ''}`
        : ''),
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
  return {
    ...(typeof station === 'number' &&
      Number.isFinite(station) &&
      station >= 0 &&
      station <= 12 && { stationHours: station }),
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
  const lastDayHours = hours(v.oneWay.lastDayHours);
  const homeHours = hours(v.oneWay.homeHours);
  // The timings only count together; one alone is ignored.
  const timed = lastDayHours !== undefined && homeHours !== undefined ? { lastDayHours, homeHours } : {};
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
    out.push({ no, name, dep, hours: h });
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

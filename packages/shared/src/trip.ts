/**
 * Outstation trips and one-way car drops: the estimate the customer sees
 * before booking, the trip saved on the booking, and the price the team agreed
 * on the call (read back for "My bookings").
 *
 * The maths lives on the website (lib/outstation.ts in Nihal51/very_new). It
 * publishes, in /app-config.json, the rules and a table of destinations with
 * the km, the hours of driving, the average wait for his train and the
 * average ride home from each pickup city — so the app repeats the website's
 * planTrip and timePrice for the customer's own start and can never disagree
 * with it. One-way drops are priced by the driver's TIME (website, 8 Nov 2026):
 *
 *     hours away = the drive (12 h a day, resting at night)
 *                + waiting for his train (the route's average, or the train picked)
 *                + the ride home
 *     price      = the day price for the distance (dayRateFor) for each 24 hours,
 *                + the hours past those blocks × outstation.extraHour,
 *                  never more than one more day
 *
 * Up to the first nearby tier (160 km) he is home the same day: one price for
 * the trip. Round trips: the days of the trip at the day price. The team
 * confirms the price on the call; the final bill uses the real times.
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
  /** Driving hours in a day (he rests the other 12 of the 24). */
  hoursPerDay: number;
  /** Per hour past the 24-hour blocks of a one-way drop (and per driving hour beyond the day on a round trip). */
  extraHour: number;
  /**
   * The day price rises with the distance (website, 8 Nov 2026): the first
   * nearby tier's `from` up to nearFromKm, rising to its `to` at its upToKm;
   * past the last tier prices.outstation.from, rising to .to at dayTopFromKm.
   * Older website files lack them: each tier's from–to as a range.
   */
  nearFromKm?: number;
  dayTopFromKm?: number;
  /**
   * Driving hours left over after the full days: up to this many at
   * extraHour, more = one more full day (website:
   * outstation.extraFullDayAfterHours, 7). Older website files lack it: no rounding.
   */
  extraFullDayAfter?: number;
  /** From the drop to the station, hours, for a place without an average wait (older website files lack it: 1). */
  stationHours?: number;
  /** Highway average with stops, km/h (older website files lack it: 50). */
  averageKmh?: number;
  /** Per day, if the customer does not give the driver his meals. */
  mealAllowance: number;
  kmPerDay: number;
  localWithinKm: number;
  /**
   * One-way drops farther than the first nearby tier (website outstation.oneWay,
   * v4 of 24 Nov 2026): the drive by distance bands, each night on the road,
   * his wait for the train home (far drops only), the bill's stops, the
   * minimum and the rounding. A website file with the older keys (v2/v3)
   * gets V4_DEFAULTS; one without oneWay: those drops are priced by the
   * driver's time.
   */
  oneWay?: OneWayRates;
  /**
   * One-way drives (website outstation.drive): speed, a break after each full
   * breakEveryHours of driving, hours on the road a day. Older files lack it:
   * the route table's driving hours, no breaks, hoursPerDay.
   */
  drive?: DriveRules;
  /** The final bill's free minutes of an hour (website outstation.graceMinutes; 15). */
  graceMinutes?: number;
  /**
   * A place not in the destination table (any place in India, places.ts):
   * road km ≈ the straight line × this (website outstation.roadFactor, 1.3).
   */
  roadFactor?: number;
  /** A round trip with up to this many hours of driving in all is back within the 24 hours: one day (14). */
  sameDayMaxHours?: number;
};

/** The customer's prices for a long one-way drop, v4 (website outstation.oneWay, 24 Nov 2026). */
export type OneWayRates = {
  /** `first` for the first firstKm. */
  firstKm: number;
  first: number;
  /** Each km from firstKm to fartherFromKm, then perKmFarther. */
  perKm: number;
  fartherFromKm: number;
  perKmFarther: number;
  /** Each night he stops on the road. */
  night: number;
  /** Farther than waitFromKm: his wait from the drop until he boards, after waitFreeHours, waitHour each started hour, at most waitMax. */
  waitFromKm: number;
  waitFreeHours: number;
  waitHour: number;
  waitMax: number;
  /** The final bill only: stops the customer asked for, after stopsFreeHours, stopsHour each started hour. */
  stopsFreeHours: number;
  stopsHour: number;
  minimum: number;
  roundTo: number;
};

/** The website's v4 settings (site-settings.ts), for a website file that still sends the older keys. */
export const V4_DEFAULTS: OneWayRates = {
  firstKm: 200,
  first: 1500,
  perKm: 2.5,
  fartherFromKm: 500,
  perKmFarther: 3.25,
  night: 300,
  waitFromKm: 500,
  waitFreeHours: 4,
  waitHour: 100,
  waitMax: 1200,
  stopsFreeHours: 1,
  stopsHour: 100,
  minimum: 1500,
  roundTo: 50,
};

/** How a one-way drive is timed (website outstation.drive). */
export type DriveRules = {
  kmh: number;
  breakEveryHours: number;
  breakMinutes: number;
  maxRoadHoursPerDay: number;
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
    /**
     * The average hours from the drop until he boards (getting to the station
     * and any change included), from the timetables (website, 8 Nov 2026).
     * Older website files lack it: stationHours.
     */
    wait?: number;
    /** The average way home to this pickup city, hours on board. */
    homeHours?: number;
  };
  roundDays: number;
};

export type TripDestination = {
  /** Stable id, saved on bookings. */
  id: string;
  name: string;
  nameHi: string;
  region: 'cg' | 'india';
  /**
   * Train route home (the website's lib/outstation.ts): the stations where
   * the driver can board, main one first, and change stations for a route
   * with one change. Missing: no train lookup (a bus route).
   */
  rail?: { stations: string[]; hubs: string[] };
  from: Record<City, CityLeg>;
};

/**
 * The day price for a place `km` away (one way, by road, from the pickup
 * city), exactly as the website's dayRateFor (8 Nov 2026): it rises with the
 * distance — the first nearby tier's `from` up to nearFromKm, its `to` at its
 * upToKm; farther, prices.outstation.from rising to .to at dayTopFromKm — to
 * the nearest ₹50. Bilaspur 113 km → ₹1,200; Janjgir 160 km → ₹1,350; Korba
 * 216 km → ₹1,550; Nagpur 284 km → ₹1,700; 300 km and farther → ₹1,750. A
 * place not in the list (0): the whole span, as a range. Older website files
 * (no nearFromKm): the tier's from–to.
 */
export function dayRateFor(config: Pick<AppConfig, 'prices' | 'outstation'>, km: number | undefined): Range {
  const d = Math.round(Number(km) || 0);
  const tiers = config.prices.outstationNear ?? [];
  const far = config.prices.outstation;
  if (d <= 0) {
    const all = [...tiers, far];
    return { from: Math.min(...all.map((t) => t.from)), to: Math.max(...all.map((t) => t.to)) };
  }
  const { nearFromKm, dayTopFromKm } = config.outstation;
  const tier = tiers.find((t) => d <= t.upToKm);
  if (nearFromKm === undefined)
    return tier ? { from: tier.from, to: tier.to } : { from: far.from, to: far.to };
  const round50 = (n: number) => Math.round(n / 50) * 50;
  const along = (from: number, to: number, lo: number, hi: number) =>
    round50(hi <= lo ? to : from + (to - from) * Math.min(1, Math.max(0, (d - lo) / (hi - lo))));
  let low = nearFromKm;
  for (const t of tiers) {
    if (d <= t.upToKm) {
      const v = along(t.from, t.to, low, t.upToKm);
      return { from: v, to: v };
    }
    low = t.upToKm;
  }
  const v = along(far.from, far.to, low, dayTopFromKm ?? low);
  return { from: v, to: v };
}

/** The driver's time on a one-way drop, priced (website timePrice). */
export type TimePrice = {
  price: number;
  /** Up to the first nearby tier's upToKm (160 km): home the same day, one price for the trip. */
  short: boolean;
  /** The price for each 24 h of his time. */
  dayRate: number;
  /** The 24-hour blocks (at least 1). */
  days: number;
  /** Whole hours from the start until he is home. */
  hours: number;
  /** Hours past the blocks, their rate and what they cost (less than a day). */
  extraHours: number;
  extraHourRate: number;
  extraCharge: number;
  km: number;
};

/** The 24-hour blocks for `hours` of his time, and the hours past them (never more than one more day). */
export function timeBlocks(
  hours: number,
  dayRate: number,
  hourRate: number,
): { days: number; extraHours: number } {
  const h = Math.max(0, Math.ceil((Number.isFinite(hours) ? hours : 0) - 1e-9));
  const days = h <= 24 ? 1 : Math.floor(h / 24);
  const extraHours = Math.max(0, h - days * 24);
  // The hours past the blocks never cost more than one more day.
  return extraHours > 0 && extraHours * hourRate >= dayRate
    ? { days: days + 1, extraHours: 0 }
    : { days, extraHours };
}

/**
 * A one-way drop's price for the driver's time, exactly as the website's
 * timePrice: the day price for the distance for each 24 hours from the start
 * until he is home (`hours`), the hours past them extraHour each — never more
 * than one more day. Undefined for an unknown place (km 0).
 *   Bilaspur 113 km, 6 h → ₹1,200. Visakhapatnam 546 km, 26 h → ₹1,750 + 2 h × ₹130.
 *   Delhi 1,214 km, 66 h → 2 × ₹1,750 + 18 h — more than a day: 3 × ₹1,750 = ₹5,250.
 */
export function timePrice(
  config: Pick<AppConfig, 'prices' | 'outstation'>,
  km: number,
  hours: number,
  rates: { dayRate?: number; extraHour?: number } = {},
): TimePrice | undefined {
  const d = Math.round(Number(km) || 0);
  if (d <= 0) return undefined;
  const dayRate = Math.round(rates.dayRate ?? dayRateFor(config, d).from);
  const extraHourRate = Math.round(rates.extraHour ?? config.outstation.extraHour);
  const h = Math.max(0, Math.ceil((Number.isFinite(hours) ? hours : 0) - 1e-9));
  const { days, extraHours } = timeBlocks(h, dayRate, extraHourRate);
  const extraCharge = extraHours * extraHourRate;
  return {
    price: days * dayRate + extraCharge,
    short: d <= (config.prices.outstationNear?.[0]?.upToKm ?? 0),
    dayRate,
    days,
    hours: h,
    extraHours,
    extraHourRate,
    extraCharge,
    km: d,
  };
}

/** The lowest to the highest day price, nearest to farthest: "₹1,050–1,750" in the app. */
export function daySpan(config: Pick<AppConfig, 'prices'>): Range {
  const near = config.prices.outstationNear ?? [];
  return {
    from: Math.min(config.prices.outstation.from, ...near.map((t) => t.from)),
    to: config.prices.outstation.to,
  };
}

/** When the customer has not picked a time, the estimate assumes the driver leaves at 7 AM (as the website). */
export const DEFAULT_START_HOUR = 7;

/** The picker's value for a place that is not in the list (typed in: the team prices it on the call). */
export const ELSEWHERE = 'other';
/** The picker's value for a place from the list of all India (places.ts): km from the map. */
export const PLACE = 'place';

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

/* ------------------------------------------------- long one-way drops */

/** Beyond this many km (one way) a one-way drop is a long one: the first nearby tier (same-day drops up to it). */
export const longOneWayFromKm = (config: Pick<AppConfig, 'prices'>): number =>
  config.prices.outstationNear?.[0]?.upToKm ?? 0;

/** Priced by the drive, the nights and his wait (website, 24 Nov 2026)? Only when the website sends the rates. */
export const isLongOneWay = (
  config: Pick<AppConfig, 'prices' | 'outstation'>,
  km: number | undefined,
): boolean => Boolean(config.outstation.oneWay) && Math.round(Number(km) || 0) > longOneWayFromKm(config);

/** Whole hours to charge for `minutes`: past the first `graceMinutes` of an hour it counts (grace 0: each started hour). */
export function chargeHours(minutes: number, graceMinutes: number): number {
  const m = Math.max(0, Math.floor(Number.isFinite(minutes) ? minutes : 0));
  const h = Math.floor(m / 60);
  return m - h * 60 > Math.max(0, graceMinutes) ? h + 1 : h;
}

/** `n` to the nearest `step` (half way: up), as the website's toNearest. */
export const toNearest = (n: number, step: number): number =>
  step > 0 ? Math.round(n / step) * step : Math.round(n);

/** The drive's price (v4): `first` for the first firstKm, perKm a km to fartherFromKm, perKmFarther after. */
export function driveCharge(
  r: Pick<OneWayRates, 'firstKm' | 'first' | 'perKm' | 'fartherFromKm' | 'perKmFarther'>,
  km: number,
): number {
  const d = Math.max(0, Math.round(Number(km) || 0));
  return (
    r.first +
    r.perKm * Math.min(Math.max(d - r.firstKm, 0), r.fartherFromKm - r.firstKm) +
    r.perKmFarther * Math.max(0, d - r.fartherFromKm)
  );
}

/**
 * His wait for the train home (v4), only farther than waitFromKm: the hours
 * from the drop until he boards, after waitFreeHours free, each started hour
 * at waitHour, never more than waitMax.  Ranchi, about 10 h 45 m → 7 h × ₹100 = ₹700.
 */
export function waitChargeOf(
  r: Pick<OneWayRates, 'waitFromKm' | 'waitFreeHours' | 'waitHour' | 'waitMax'>,
  km: number,
  waitHours: number,
): { hours: number; charge: number } {
  if (!(Math.round(Number(km) || 0) > r.waitFromKm)) return { hours: 0, charge: 0 };
  const w = Math.max(0, (Number.isFinite(waitHours) ? waitHours : 0) - r.waitFreeHours);
  const hours = w > 1e-9 ? Math.ceil(w - 1e-9) : 0;
  return { hours, charge: Math.min(r.waitMax, hours * r.waitHour) };
}

export type LongOneWayPrice = {
  /** What the customer pays before his ticket: max(minimum, drive + nights + wait (+ stops) to the nearest roundTo). */
  price: number;
  km: number;
  /** The drive's price, exact (2.5 a km can leave paise). */
  drive: number;
  nights: number;
  night: number;
  nightsCharge: number;
  /** His wait: the hours (drop → boarding), whether it is charged at this distance, the hours charged, the charge. */
  waitHours: number;
  waitApplies: boolean;
  waitCharged: number;
  waitHour: number;
  waitCharge: number;
  /** The final bill's stops (0 on an estimate). */
  stopsHours: number;
  stopsHour: number;
  stopsCharge: number;
  /** Before the rounding and the minimum. */
  subtotal: number;
  roundTo: number;
  minimum: number;
  minimumApplies: boolean;
};

/**
 * A long one-way drop's price (v4) — exactly as the website's
 * longOneWayPrice: the drive by distance bands, each night on the road, his
 * wait for the train home, the bill's stops; to the nearest roundTo, at
 * least the minimum. The train ride itself is never charged.
 *   Raipur → Ranchi, 616 km, no night, wait 10¾ h: 2,627 + 700 = 3,327 → ₹3,350.
 *   Raipur → Bengaluru, 1,370 km, 2 nights, wait 8¾ h: 5,077.50 + 600 + 500 → ₹6,200.
 */
export function longOneWayPrice(
  r: OneWayRates,
  km: number,
  parts: { nights: number; waitHours: number; stopsHours?: number },
): LongOneWayPrice {
  const d = Math.max(0, Math.round(Number(km) || 0));
  const drive = driveCharge(r, d);
  const nights = Math.max(0, Math.floor(Number(parts.nights) || 0));
  const wait = waitChargeOf(r, d, parts.waitHours);
  const stopsHours = Math.max(0, Math.floor(Number(parts.stopsHours) || 0));
  const stopsCharge = stopsHours * r.stopsHour;
  const subtotal = drive + nights * r.night + wait.charge + stopsCharge;
  const rounded = toNearest(subtotal, r.roundTo);
  return {
    price: Math.max(r.minimum, rounded),
    km: d,
    drive,
    nights,
    night: r.night,
    nightsCharge: nights * r.night,
    waitHours: Math.max(0, Number(parts.waitHours) || 0),
    waitApplies: d > r.waitFromKm,
    waitCharged: wait.hours,
    waitHour: r.waitHour,
    waitCharge: wait.charge,
    stopsHours,
    stopsHour: r.stopsHour,
    stopsCharge,
    subtotal,
    roundTo: r.roundTo,
    minimum: r.minimum,
    minimumApplies: rounded < r.minimum,
  };
}

/** Nights he stops on the road on a one-way plan (v4): its calendar days − 1; none driven day and night. */
export const nightsOf = (plan: Pick<TripPlan, 'days' | 'nonstop'>): number =>
  plan.nonstop ? 0 : Math.max(0, (plan.days || 1) - 1);

/** Hours from the drop until he boards on a one-way plan: the route's usual wait (or stationHours), or the picked train's departure. */
export const waitHoursOfPlan = (plan: Pick<TripPlan, 'dropAt' | 'leaveAt'>): number =>
  plan.dropAt !== undefined && plan.leaveAt !== undefined ? Math.max(0, plan.leaveAt - plan.dropAt) : 0;

/**
 * A one-way drive's time on the road (website roadTime): driving at kmh, and
 * a break of breakMinutes after each full breakEveryHours of driving.
 *   Raipur → Ranchi, 616 km: 11 h 12 m + 2 breaks (1 h 10 m) = 12 h 22 m.
 */
export function roadTime(
  drive: DriveRules,
  km: number,
): { driveHours: number; breaks: number; breakHours: number; roadHours: number } {
  const h = Math.max(0, Number(km) || 0) / drive.kmh;
  const breaks =
    drive.breakMinutes > 0 && drive.breakEveryHours > 0 ? Math.floor(h / drive.breakEveryHours) : 0;
  const breakHours = (breaks * drive.breakMinutes) / 60;
  return { driveHours: h, breaks, breakHours, roadHours: h + breakHours };
}

/* ------------------------------------------------------------------ plan */

export type TripEstimate = {
  /** What the customer sees: one number for a place in the list. */
  from: number;
  to: number;
  /** The days charged and the price for each (one-way: the 24-hour blocks of his time). */
  days: number;
  dayRate: Range;
  /** One-way up to the first nearby tier (8 Nov 2026), or farther on an older website: the price for the driver's time. */
  time?: TimePrice;
  /** One-way farther than that (v4, 24 Nov 2026): the drive, the nights on the road and his wait for the train. */
  long?: LongOneWayPrice;
};

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
  /** One-way with the website's drive rules: the breaks on the way, and the hours on the road with them. */
  breaks?: number;
  roadHours?: number;
  /** One-way: whole hours from the drop until he is home, the waiting included. */
  returnHours: number;
  /** The start: hour of the day and, if known, the weekday (0 = Sunday). */
  startHour: number;
  weekday?: number;
  /** One-way, when the table has the timings: hours after the start he drops the car, leaves and is home. */
  dropAt?: number;
  leaveAt?: number;
  homeAt?: number;
  /** One-way with a train from the lookup: hours of waiting for it (at the drop and at a change). */
  waitHours?: number;
  /** Closer than localWithinKm: a local package is usually cheaper. */
  local: boolean;
  /** The pickup city itself was picked. */
  sameCity: boolean;
  est?: TripEstimate;
};

/** When the driver leaves: the hour of the day and, if the date is known, the weekday. */
export type TripStart = { hour: number; weekday?: number };

const MAX_DAYS = 60;

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

/**
 * The trip for the form, exactly as the website's planTrip and estimate. `bookedDays` is
 * what the customer chose (0 = as few as the distance allows); `start` the
 * hour the driver leaves (and the weekday, if the date is known); `nonstop`
 * day and night (one-way).
 */
export function planTrip(
  config: AppConfig,
  pkg: TripPackage,
  city: City | '',
  /** A curated destination's id, ELSEWHERE, or a place from the list of all India (places.ts placeDestination). */
  destId: string | TripDestination,
  bookedDays = 0,
  start: TripStart | number = DEFAULT_START_HOUR,
  nonstop = false,
  /**
   * A real train home from the lookup: hours after the start it leaves and
   * gets him home, and his waiting in all (the drop to boarding, and any
   * change; without it, the drop to boarding).
   */
  train?: { leaveAt: number; homeAt: number; waitHours?: number },
): TripPlan {
  const kind = TRIP_PACKAGES[pkg];
  const raw = typeof start === 'number' ? { hour: start } : start;
  const hour = Number.isFinite(raw.hour) ? ((raw.hour % 24) + 24) % 24 : DEFAULT_START_HOUR;
  const weekday =
    raw.weekday !== undefined && Number.isInteger(raw.weekday) && raw.weekday >= 0 && raw.weekday <= 6
      ? raw.weekday
      : undefined;
  const dest =
    typeof destId === 'object'
      ? destId
      : destId && destId !== ELSEWHERE
        ? config.destinations.find((d) => d.id === destId)
        : undefined;
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
  const local = leg.km < rules.localWithinKm;

  if (kind === 'round') {
    // The days of the trip at the day price for the distance.
    const rate = dayRateFor(config, leg.km);
    const days = Math.max(leg.roundDays, booked);
    return {
      ...base,
      ...none,
      km: leg.km,
      minDays: leg.roundDays,
      days,
      fullDays: days,
      local,
      est: { from: days * rate.from, to: days * rate.to, days, dayRate: rate },
    };
  }

  // Driving: each hoursPerDay is a day, the rest by the hour. With the website's drive rules (v3): at
  // drive.kmh with a break after each full breakEveryHours, maxRoadHoursPerDay on the road a day.
  const straight = nonstop;
  const road = rules.drive ? roadTime(rules.drive, leg.km) : undefined;
  const hours = road ? road.driveHours : (leg.oneWay.driveHours ?? leg.km / (rules.averageKmh ?? 50));
  const onRoad = road ? road.roadHours : hours;
  const day = rules.drive?.maxRoadHoursPerDay ?? rules.hoursPerDay;
  const full = Math.floor(onRoad / day + 1e-9);
  const rest = onRoad - full * day;
  const leftover = rest > 1e-9 ? Math.ceil(rest - 1e-9) : 0;
  const lastDayAt = dropTime(day, onRoad, straight);
  const calendar = straight
    ? Math.max(1, Math.ceil((lastDayAt - 1e-9) / 24))
    : full + (rest > 1 + 1e-9 || full === 0 ? 1 : 0);
  const extraDays = booked > calendar ? booked - calendar : 0;
  // More than extraFullDayAfter hours left over: one more full day instead (as on the website).
  const roundUp = leftover > (rules.extraFullDayAfter ?? 24);
  const fullDays = extraDays > 0 ? booked : full + (roundUp ? 1 : 0);
  const extraHours = extraDays > 0 || roundUp ? 0 : leftover;

  // The way home, as on the website: the route's average wait for his train (getting to the station
  // included) and ride home — or the real train from the lookup (rail.ts), when there is one.
  const dropAt = lastDayAt + (straight ? 0 : extraDays * 24);
  let timing: Pick<TripPlan, 'returnHours' | 'dropAt' | 'leaveAt' | 'homeAt' | 'waitHours'> = {
    returnHours: leg.oneWay.returnHours,
  };
  const homeHours = leg.oneWay.homeHours;
  if (homeHours !== undefined && (road || leg.oneWay.driveHours !== undefined)) {
    const leaveAt = dropAt + (leg.oneWay.wait ?? rules.stationHours ?? 1);
    const homeAt = leaveAt + homeHours;
    timing = { returnHours: Math.max(0, Math.ceil(homeAt - dropAt - 1e-9)), dropAt, leaveAt, homeAt };
    // The train the customer chose (or the first one found) instead of the average.
    if (train && train.leaveAt >= dropAt && train.homeAt > train.leaveAt) {
      timing = {
        returnHours: Math.max(0, Math.ceil(train.homeAt - dropAt - 1e-9)),
        dropAt,
        leaveAt: train.leaveAt,
        homeAt: train.homeAt,
        waitHours: train.waitHours ?? train.leaveAt - dropAt,
      };
    }
  }

  // Farther than the first nearby tier (website, 24 Nov 2026, v4): the drive, the nights he stops on the
  // road, and his wait from the drop until he boards (the route's usual wait, or the picked train's departure).
  const rates = rules.oneWay;
  const long =
    rates && timing.homeAt !== undefined && timing.dropAt !== undefined && isLongOneWay(config, leg.km)
      ? longOneWayPrice(rates, leg.km, {
          nights: nightsOf({ days: Math.max(1, calendar + extraDays), nonstop: straight }),
          waitHours: waitHoursOfPlan(timing),
        })
      : undefined;
  // Otherwise the price for his time: from the start until he is home (a table without the timings:
  // the drop and the hours home it gives).
  const time = long ? undefined : timePrice(config, leg.km, timing.homeAt ?? dropAt + leg.oneWay.returnHours);
  return {
    ...base,
    km: leg.km,
    minDays: calendar,
    days: calendar + extraDays,
    fullDays,
    extraHours,
    driveHours: hours,
    ...(road && { breaks: road.breaks, roadHours: road.roadHours }),
    nonstop: straight,
    ...timing,
    local,
    ...(long && {
      est: {
        from: long.price,
        to: long.price,
        days: Math.max(1, calendar + extraDays),
        dayRate: { from: long.drive, to: long.drive },
        long,
      },
    }),
    ...(time && {
      est: {
        from: time.price,
        to: time.price,
        days: time.days,
        dayRate: { from: time.dayRate, to: time.dayRate },
        time,
      },
    }),
  };
}

/* ------------------------------------------------------ the train home */

/** The station the driver comes home to, by pickup city (as the website's pickupStations). */
export const PICKUP_STATIONS: Record<City, string> = {
  Raipur: 'R',
  Bhilai: 'DURG',
  Durg: 'DURG',
  Bilaspur: 'BSP',
};

/**
 * What the train lookup (rail.ts findReturn) needs for this plan: the
 * destination's stations and change stations, the home station, and when he
 * drops the car and can board (drop + stationHours). Undefined when there is
 * nothing to look up: a round trip, a bus route, no timings.
 */
export function railInputOf(plan: TripPlan, city: City | '', startAt: number, stationHours: number) {
  if (plan.kind !== 'one-way' || !plan.dest?.rail || plan.dropAt === undefined || !city) return undefined;
  const drop = startAt + Math.round(plan.dropAt * 60) * 60_000;
  return {
    stations: [...plan.dest.rail.stations],
    hubs: [...plan.dest.rail.hubs],
    home: PICKUP_STATIONS[city],
    drop,
    ready: drop + Math.round(stationHours * 60) * 60_000,
  };
}

/**
 * A route home from the lookup → planTrip's `train`: hours after the start,
 * and his waiting in all (rail.ts waitHoursOf: the drop to boarding and any change).
 */
export const trainHours = (
  o: { depart: number; arrive: number; waitMinutes?: number; transfer?: { minutes: number } },
  startAt: number,
) => ({
  leaveAt: (o.depart - startAt) / 3_600_000,
  homeAt: (o.arrive - startAt) / 3_600_000,
  ...(o.waitMinutes !== undefined && { waitHours: (o.waitMinutes + (o.transfer?.minutes ?? 0)) / 60 }),
});

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
  /** The extra hours' charge (quotes from 29 Oct 2026): a drive shorter than a day at the short-drive price. Missing: extraHours × extraHourRate. */
  extraCharge?: number;
  /**
   * A route price (quotes from 1 Nov 2026): the hours away and the km; then one day at dayRate = the price.
   * The km without awayHours (quotes from 8 Nov 2026, pricedByTime): the driver's time — days = the
   * 24-hour blocks at dayRate, extraHours past them at extraHourRate, no way-home charge.
   */
  awayHours?: number;
  km?: number;
  ticket: number;
};

/** A saved quote or bill priced by the driver's time (from 8 Nov 2026): the km, and no route hours or way-home charge. */
export const pricedByTime = (q: {
  km?: number;
  awayHours?: number;
  returnHours: number;
  returnCharge: number;
}): boolean => Boolean(q.km && q.km > 0 && !q.awayHours && !q.returnHours && !q.returnCharge);

/** The real times of the trip, from the driver's trip link (website firestore.rules: isClock). */
/** boardAt: one-way, the driver boarded his train home (v4, copied from his tap). */
export type BookingClock = { startAt?: Date; dropAt?: Date; boardAt?: Date; homeAt?: Date };

/** The final bill from the real times, saved by the team (website firestore.rules: isBill). */
export type BookingBill = {
  amount: number;
  dayRate: number;
  days: number;
  extraHours: number;
  extraHourRate: number;
  /** extraHours × extraHourRate, at most one day. */
  extraCharge: number;
  returnHours: number;
  returnHourRate: number;
  returnCharge: number;
  /**
   * A route price (bills from 1 Nov 2026): the planned hours away and the km; one day at the price, extraHours = hours late.
   * The km without awayHours (bills from 8 Nov 2026): the driver's time, as BookingQuote.
   */
  awayHours?: number;
  km?: number;
  ticket: number;
  /** Driven day and night (every 12 h a day). */
  nonstop: boolean;
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
  const extra = int(v.extraCharge);
  if (extra !== null) out.extraCharge = extra;
  const away = int(v.awayHours);
  if (away) out.awayHours = away;
  const km = int(v.km);
  if (km) out.km = km;
  return out.amount > 0 ? out : undefined;
}

/** Firestore Timestamp | Date → Date, without importing the Firebase SDK. */
function asDate(v: unknown): Date | undefined {
  if (v instanceof Date) return v;
  if (isObj(v) && typeof (v as { toDate?: unknown }).toDate === 'function')
    return (v as { toDate: () => Date }).toDate();
  return undefined;
}

/** A stored clock → BookingClock, or undefined if there is none (no start yet). */
export function toClock(v: unknown): BookingClock | undefined {
  if (!isObj(v)) return undefined;
  const out: BookingClock = {};
  for (const k of ['startAt', 'dropAt', 'boardAt', 'homeAt'] as const) {
    const d = asDate(v[k]);
    if (d) out[k] = d;
  }
  return out.startAt ? out : undefined;
}

/** A stored final bill → BookingBill, or undefined if it is missing or odd. */
export function toBill(v: unknown): BookingBill | undefined {
  if (!isObj(v)) return undefined;
  const keys = [
    'amount',
    'dayRate',
    'days',
    'extraHours',
    'extraHourRate',
    'extraCharge',
    'returnHours',
    'returnHourRate',
    'returnCharge',
    'ticket',
  ] as const;
  const out = { nonstop: v.nonstop === true } as BookingBill;
  for (const k of keys) {
    const n = int(v[k]);
    if (n === null) return undefined;
    out[k] = n;
  }
  const away = int(v.awayHours);
  if (away) out.awayHours = away;
  const km = int(v.km);
  if (km) out.km = km;
  return out.amount > 0 ? out : undefined;
}

/* ------------------------------------------------------- config checks -- */

const isPositive = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 1_000_000;

export function parseTripRules(v: unknown): TripRules | null {
  if (!isObj(v)) return null;
  const keys = ['hoursPerDay', 'extraHour', 'mealAllowance', 'kmPerDay', 'localWithinKm'] as const;
  if (!keys.every((k) => isPositive(v[k]))) return null;
  const station = v.stationHours;
  const kmh = v.averageKmh;
  // The website publishes extraFullDayAfterHours; the phone's saved copy keeps extraFullDayAfter.
  const extraAfter = v.extraFullDayAfterHours ?? v.extraFullDayAfter;
  // The rising day price (website, 8 Nov 2026) comes as a pair; anything odd and the tiers are ranges.
  const km = (x: unknown) =>
    typeof x === 'number' && Number.isInteger(x) && x >= 0 && x <= 3000 ? x : undefined;
  const nearFrom = km(v.nearFromKm);
  const topFrom = km(v.dayTopFromKm);
  const rising = nearFrom !== undefined && topFrom !== undefined && topFrom > nearFrom;
  const oneWay = parseOneWay(v.oneWay);
  const drive = parseDrive(v.drive);
  const grace = v.graceMinutes;
  const factor = v.roadFactor;
  const sameDay = v.sameDayMaxHours;
  // Older files also carry the way-home and route-price keys: no longer used, left out.
  return {
    ...(oneWay && { oneWay }),
    ...(drive && { drive }),
    ...(typeof factor === 'number' &&
      Number.isFinite(factor) &&
      factor >= 1 &&
      factor <= 3 && { roadFactor: factor }),
    ...(typeof sameDay === 'number' &&
      Number.isFinite(sameDay) &&
      sameDay > 0 &&
      sameDay <= 48 && { sameDayMaxHours: sameDay }),
    ...(typeof grace === 'number' &&
      Number.isInteger(grace) &&
      grace >= 0 &&
      grace <= 59 && { graceMinutes: grace }),
    ...(rising && { nearFromKm: nearFrom, dayTopFromKm: topFrom }),
    ...(typeof extraAfter === 'number' &&
      Number.isInteger(extraAfter) &&
      extraAfter >= 0 &&
      extraAfter <= 23 && { extraFullDayAfter: extraAfter }),
    ...(typeof station === 'number' &&
      Number.isFinite(station) &&
      station >= 0 &&
      station <= 12 && { stationHours: station }),
    ...(typeof kmh === 'number' && Number.isFinite(kmh) && kmh >= 20 && kmh <= 120 && { averageKmh: kmh }),
    hoursPerDay: v.hoursPerDay as number,
    extraHour: v.extraHour as number,
    mealAllowance: v.mealAllowance as number,
    kmPerDay: v.kmPerDay as number,
    localWithinKm: v.localWithinKm as number,
  };
}

/** outstation.drive → checked timing, or undefined (absent or odd: the route table's hours, no breaks). */
function parseDrive(v: unknown): DriveRules | undefined {
  if (!isObj(v)) return undefined;
  const n = (x: unknown, lo: number, hi: number) =>
    typeof x === 'number' && Number.isFinite(x) && x >= lo && x <= hi;
  if (
    !n(v.kmh, 20, 120) ||
    !n(v.breakEveryHours, 0, 24) ||
    !n(v.breakMinutes, 0, 180) ||
    !n(v.maxRoadHoursPerDay, 1, 24)
  )
    return undefined;
  return {
    kmh: v.kmh as number,
    breakEveryHours: v.breakEveryHours as number,
    breakMinutes: v.breakMinutes as number,
    maxRoadHoursPerDay: v.maxRoadHoursPerDay as number,
  };
}

/** The 14 keys of outstation.oneWay (v4). */
const ONE_WAY_KEYS = Object.keys(V4_DEFAULTS) as (keyof OneWayRates)[];

/**
 * outstation.oneWay → checked v4 rates. A file with the older keys (v2
 * driveDay…, v3 perKm 3 / homeHour…) or an odd value gets V4_DEFAULTS (the
 * website's settings since 24 Nov 2026); no oneWay at all: undefined (those
 * drops keep the driver's-time price).
 */
function parseOneWay(v: unknown): OneWayRates | undefined {
  if (!isObj(v)) return undefined;
  const ok = (x: unknown) => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 100_000;
  if (!ONE_WAY_KEYS.every((k) => ok(v[k]))) return { ...V4_DEFAULTS };
  const r = Object.fromEntries(ONE_WAY_KEYS.map((k) => [k, v[k] as number])) as OneWayRates;
  // Bands in order, a rounding step: anything else is not a price list.
  if (r.fartherFromKm < r.firstKm || r.roundTo < 1) return { ...V4_DEFAULTS };
  return r;
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
  // The average wait for his train (website, 8 Nov 2026); older files: stationHours.
  const wait = hours(v.oneWay.wait);
  // The timings only count together; one alone is ignored.
  const timed =
    driveHours !== undefined && homeHours !== undefined
      ? { driveHours, ...(wait !== undefined && { wait }), homeHours }
      : {};
  return { km, oneWay: { days, returnHours: back, ...timed }, roundDays: round };
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
    let rail: TripDestination['rail'];
    if (row.rail !== undefined) {
      if (!isObj(row.rail)) return null;
      const codes = (v: unknown, max: number) =>
        Array.isArray(v) && v.length <= max && v.every((c) => typeof c === 'string' && /^[A-Z]{1,5}$/.test(c))
          ? (v as string[])
          : null;
      const stations = codes(row.rail.stations, 6);
      const hubs = row.rail.hubs === undefined ? [] : codes(row.rail.hubs, 4);
      if (!stations?.length || !hubs) return null;
      rail = { stations: [...stations], hubs: [...hubs] };
    }
    out.push({ id, name, nameHi: nameHi || name, region, ...(rail && { rail }), from });
  }
  return out;
}

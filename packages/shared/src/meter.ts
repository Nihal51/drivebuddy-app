/**
 * The live fare meter on the customer's booking screen while the driver is on
 * the job (status "assigned") — the same rules the alerts robot bills by, so
 * the "so far" figure is what the bill will say if the job ended now.
 *
 * - Local jobs (1 h, 3 h, 12 h, full day, night): from the driver's Arrived
 *   tap (the robot writes it as `clock.startAt`). Each hour counts once it is
 *   more than 15 minutes old (3 h 15 min = 3 h, 3 h 16 min = 4 h); past the
 *   package's hours, each one at prices.localExtraHour. The package price is
 *   the one agreed on the call, else the price the customer accepted, else
 *   the site's price (full day: the top of its range; night: its from-price)
 *   — the robot's estimateOf order.
 * - Trips (outstation / one-way drop): from Start (`clock.startAt`) until he
 *   is home (`clock.homeAt`, or now). The estimate the customer booked, or —
 *   once the trip runs longer than that — the driver's time priced the way
 *   the estimate is (trip.ts timePrice: 24-hour blocks at the trip's day
 *   price, the hours past them at outstation.extraHour, never more than one
 *   more day). A one-way drop past the first nearby tier, when the website
 *   sends outstation.oneWay: driving days from Start to the drop, then his
 *   way home from the drop (trip.ts longOneWayPrice, the bill's 15 minutes'
 *   grace).
 *
 * Nothing here is a bill: the robot (local) or the office (trips) makes that
 * when the job ends.
 */

import type { Booking } from './booking';
import type { PackageId } from './catalog';
import type { AppConfig } from './config';
import { isLongOneWay, isTripPackage, longOneWayPrice, longReturnDayFor, timePrice } from './trip';

/** Hours each local package includes (the robot's LOCAL_BASE_HOURS). */
export const LOCAL_BASE_HOURS: Partial<Record<PackageId, number>> = {
  '1-hour-300': 1,
  '3-hours-600': 3,
  'local-12-hours': 12,
  'local-full-day': 8,
  'night-driver': 10,
};

/** An hour counts only once it is more than this many minutes old (the robot's LOCAL_GRACE_MIN). */
export const LOCAL_GRACE_MIN = 15;

const MINUTE = 60_000;

/** Whole minutes from `fromMs` to `toMs` (0 if the clock is ahead). */
export const minutesBetween = (fromMs: number, toMs: number): number =>
  Math.floor(Math.max(0, toMs - fromMs) / MINUTE);

/** Whole hours used, an hour counting only after the grace minutes: 3 h 15 min → 3, 3 h 16 min → 4. */
export function usedHours(minutes: number, graceMin: number = LOCAL_GRACE_MIN): number {
  return Math.max(0, Math.ceil((Math.max(0, Math.floor(minutes)) - graceMin) / 60));
}

const whole = (v: unknown): number | null =>
  typeof v === 'number' && Number.isInteger(v) && v >= 100 && v <= 500_000 ? v : null;

/** A local package's price: agreed on the call → accepted in the app → the site's price; null if none. */
export function localPackagePrice(
  b: Pick<Booking, 'packageId' | 'quote' | 'acceptedPrice'>,
  config: Pick<AppConfig, 'prices'>,
): number | null {
  const agreed = whole(b.quote?.amount) ?? whole(b.acceptedPrice?.amount);
  if (agreed) return agreed;
  const p = config.prices;
  const site: Partial<Record<PackageId, number | undefined>> = {
    '1-hour-300': p.oneHour,
    '3-hours-600': p.threeHours,
    'local-12-hours': p.twelveHours,
    'local-full-day': p.fullDay.to,
    'night-driver': p.nightFrom,
  };
  return b.packageId ? whole(Math.round(site[b.packageId] ?? 0)) : null;
}

export type LocalMeter = {
  kind: 'local';
  /** Minutes since he arrived. */
  minutes: number;
  baseHours: number;
  usedHours: number;
  extraHours: number;
  extraHourRate: number;
  packagePrice: number;
  /** What the bill would be if the job ended now. */
  amount: number;
};

export type TripMeter = {
  kind: 'trip';
  /** Minutes since he left (until he got home, once he has). */
  minutes: number;
  /** The estimate, or null when there is none to show (a place not in the list, no price yet). */
  amount: number | null;
  /** The trip has run past what was booked: priced from his real time. */
  overBooked: boolean;
};

export type FareMeter = LocalMeter | TripMeter;

export function localMeter(
  b: Pick<Booking, 'packageId' | 'quote' | 'acceptedPrice' | 'clock'>,
  config: Pick<AppConfig, 'prices'>,
  now: number,
): LocalMeter | null {
  const base = b.packageId ? LOCAL_BASE_HOURS[b.packageId] : undefined;
  const start = b.clock?.startAt;
  if (!base || !start) return null;
  const price = localPackagePrice(b, config);
  if (!price) return null;
  const minutes = minutesBetween(start.getTime(), now);
  const used = usedHours(minutes);
  const extra = Math.max(0, used - base);
  const rate = Math.max(0, Math.round(config.prices.localExtraHour));
  return {
    kind: 'local',
    minutes,
    baseHours: base,
    usedHours: used,
    extraHours: extra,
    extraHourRate: rate,
    packagePrice: price,
    amount: price + extra * rate,
  };
}

export function tripMeter(
  b: Pick<Booking, 'packageId' | 'quote' | 'acceptedPrice' | 'clock' | 'trip'>,
  config: Pick<AppConfig, 'prices' | 'outstation'>,
  now: number,
): TripMeter | null {
  const start = b.clock?.startAt;
  if (!isTripPackage(b.packageId) || !start) return null;
  const end = b.clock?.homeAt?.getTime() ?? now;
  const minutes = minutesBetween(start.getTime(), end);
  const booked = whole(b.quote?.amount) ?? whole(b.acceptedPrice?.amount) ?? whole(b.trip?.estTo);
  const km = b.trip?.km ?? b.quote?.km ?? 0;
  const real =
    b.packageId === 'one-way-drop' && isLongOneWay(config, km) ? longSoFar(b, config, km, now) : timeSoFar();
  if (booked === null) return { kind: 'trip', minutes, amount: null, overBooked: false };
  const over = real !== undefined && real > booked;
  return { kind: 'trip', minutes, amount: over ? real : booked, overBooked: over };

  /** His time priced like the estimate: 24-hour blocks, at the agreed day rate if the call set one. */
  function timeSoFar(): number | undefined {
    return timePrice(config, km, minutes / 60, {
      ...(whole(b.quote?.dayRate) ? { dayRate: b.quote?.dayRate } : {}),
      ...(b.quote && b.quote.extraHourRate > 0 ? { extraHour: b.quote.extraHourRate } : {}),
    })?.price;
  }
}

/**
 * A long one-way drop so far, as its final bill will count it: driving days
 * from Start to the drop (or now), then his way home from the drop to home
 * (or now), the first graceMinutes of an hour free — at the rates agreed on
 * the call, else the website's.
 */
function longSoFar(
  b: Pick<Booking, 'quote' | 'clock'>,
  config: Pick<AppConfig, 'outstation'>,
  km: number,
  now: number,
): number | undefined {
  const start = b.clock?.startAt?.getTime();
  if (start === undefined) return undefined;
  const drop = b.clock?.dropAt?.getTime();
  const home = b.clock?.homeAt?.getTime() ?? now;
  const driveMinutes = minutesBetween(start, drop ?? now);
  const returnMinutes = drop === undefined ? 0 : minutesBetween(drop, home);
  const q = b.quote;
  const rates =
    q && q.returnHourRate > 0 && whole(q.dayRate)
      ? {
          drivingDay: q.dayRate,
          returnHour: q.returnHourRate,
          returnDay: longReturnDayFor(config, q.returnHourRate),
        }
      : {};
  return longOneWayPrice(
    config,
    km,
    driveMinutes / 60,
    returnMinutes,
    rates,
    0,
    config.outstation.graceMinutes ?? 15,
  )?.price;
}

/** The meter for a booking the driver is on now, or null (not on the job yet, no start time, not metered). */
export function fareMeter(
  b: Pick<Booking, 'status' | 'packageId' | 'quote' | 'acceptedPrice' | 'clock' | 'trip'>,
  config: Pick<AppConfig, 'prices' | 'outstation'>,
  now: number,
): FareMeter | null {
  if (b.status !== 'assigned') return null;
  return isTripPackage(b.packageId) ? tripMeter(b, config, now) : localMeter(b, config, now);
}

/** Minutes → days, hours and minutes, for "1 day 4 h" / "9 h 20 min". */
export function splitMinutes(minutes: number): { days: number; hours: number; minutes: number } {
  const m = Math.max(0, Math.floor(minutes));
  return { days: Math.floor(m / 1440), hours: Math.floor((m % 1440) / 60), minutes: m % 60 };
}

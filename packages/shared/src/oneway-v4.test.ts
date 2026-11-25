/**
 * One-way drops over 160 km, v4 (SPEC-v4 §1, website lib/outstation.ts
 * longOneWayPrice): the drive by distance bands, each night on the road, his
 * wait for the train home past 500 km; to the nearest ₹50, at least ₹1,500.
 * The spec's examples (Raipur, 7 AM, the route's usual wait) — the website's
 * tests have the same numbers.
 */

import { toBooking } from './booking';
import { type AppConfig, DEFAULT_CONFIG, parseAppConfig } from './config';
import { tripMeter } from './meter';
import {
  V4_DEFAULTS,
  driveCharge,
  longOneWayPrice,
  nightsOf,
  planTrip,
  tripRecord,
  waitChargeOf,
  waitHoursOfPlan,
} from './trip';

const DRIVE = { kmh: 55, breakEveryHours: 4, breakMinutes: 35, maxRoadHoursPerDay: 12 };
const CONFIG: AppConfig = {
  ...DEFAULT_CONFIG,
  outstation: { ...DEFAULT_CONFIG.outstation, oneWay: V4_DEFAULTS, drive: DRIVE },
};
const fromRaipur = (dest: string) => planTrip(CONFIG, 'one-way-drop', 'Raipur', dest);

describe('the spec’s examples, from Raipur', () => {
  test.each([
    ['gondia', 1500],
    ['korba', 1550],
    ['nagpur', 1700],
    ['ambikapur', 1850],
    ['jabalpur', 1950],
    ['visakhapatnam', 2500],
    ['bhubaneswar', 2900],
    ['prayagraj', 2800],
    ['ranchi', 3350],
    ['bhopal', 3050],
    ['lucknow', 4650],
    ['hyderabad', 4050],
    ['mumbai', 4650],
    ['delhi', 5250],
    ['bengaluru', 6200],
    ['chennai', 6400],
  ])('%s → ₹%i', (dest, price) => {
    expect(fromRaipur(dest).est).toMatchObject({ from: price, to: price });
  });

  test('Ranchi: drive 616 km ₹2,627 + wait about 10¾ h → 7 h × ₹100 = ₹700 → ₹3,350', () => {
    expect(fromRaipur('ranchi').est?.long).toMatchObject({
      km: 616,
      drive: 2627,
      nights: 0,
      waitApplies: true,
      waitCharged: 7,
      waitCharge: 700,
      subtotal: 3327,
      price: 3350,
      minimumApplies: false,
    });
    expect(fromRaipur('ranchi').est?.long?.waitHours).toBeCloseTo(10.75, 5);
  });

  test('Bengaluru: 2 nights on the road; Gondia: the minimum; Nagpur: no wait charge at 284 km', () => {
    expect(fromRaipur('bengaluru').est?.long).toMatchObject({
      drive: 5077.5,
      nights: 2,
      nightsCharge: 600,
      waitCharge: 500,
    });
    expect(fromRaipur('gondia').est?.long).toMatchObject({
      drive: 1502.5,
      price: 1500,
      minimumApplies: false,
    });
    expect(fromRaipur('nagpur').est?.long).toMatchObject({ waitApplies: false, waitCharge: 0 });
  });

  test('saved on the booking as the website saves it: the plan’s days and the estimate', () => {
    const plan = fromRaipur('bengaluru');
    expect(tripRecord(plan, '')).toMatchObject({ km: 1370, days: 3, estFrom: 6200, estTo: 6200 });
  });
});

describe('the parts', () => {
  test('the drive: ₹1,500 for 200 km, ₹2.50 a km to 500, ₹3.25 after', () => {
    expect(driveCharge(V4_DEFAULTS, 150)).toBe(1500);
    expect(driveCharge(V4_DEFAULTS, 200)).toBe(1500);
    expect(driveCharge(V4_DEFAULTS, 500)).toBe(2250);
    expect(driveCharge(V4_DEFAULTS, 616)).toBe(2627);
  });

  test('his wait: only past 500 km, the first 4 h free, each started hour ₹100, at most ₹1,200', () => {
    expect(waitChargeOf(V4_DEFAULTS, 500, 20)).toEqual({ hours: 0, charge: 0 });
    expect(waitChargeOf(V4_DEFAULTS, 501, 4)).toEqual({ hours: 0, charge: 0 });
    expect(waitChargeOf(V4_DEFAULTS, 501, 4.01)).toEqual({ hours: 1, charge: 100 });
    expect(waitChargeOf(V4_DEFAULTS, 616, 10.75)).toEqual({ hours: 7, charge: 700 });
    expect(waitChargeOf(V4_DEFAULTS, 616, 30)).toEqual({ hours: 26, charge: 1200 });
  });

  test('nights: the plan’s days − 1, none driven day and night; the wait: drop → his train', () => {
    expect(nightsOf({ days: 3, nonstop: false })).toBe(2);
    expect(nightsOf({ days: 3, nonstop: true })).toBe(0);
    expect(waitHoursOfPlan({ dropAt: 12.5, leaveAt: 20 })).toBe(7.5);
    expect(planTrip(CONFIG, 'one-way-drop', 'Raipur', 'bengaluru', 0, 7, true).est?.long?.nights).toBe(0);
  });

  test('the bill’s stops; the rounding; a picked train sets the wait', () => {
    expect(longOneWayPrice(V4_DEFAULTS, 616, { nights: 0, waitHours: 10.75, stopsHours: 2 })).toMatchObject({
      stopsCharge: 200,
      price: 3550,
    });
    const dropAt = fromRaipur('ranchi').dropAt ?? 0;
    const train = planTrip(CONFIG, 'one-way-drop', 'Raipur', 'ranchi', 0, 7, false, {
      leaveAt: dropAt + 2,
      homeAt: dropAt + 12,
    });
    expect(train.est?.long).toMatchObject({ waitHours: 2, waitCharge: 0, price: 2650 });
  });
});

describe('the website file', () => {
  const file = (outstation: Record<string, unknown>, trains?: Record<string, unknown>) =>
    parseAppConfig({
      ...JSON.parse(JSON.stringify(DEFAULT_CONFIG)),
      outstation: { ...DEFAULT_CONFIG.outstation, ...outstation },
      ...(trains && { trains: { ...DEFAULT_CONFIG.trains, ...trains } }),
    });

  test('the 14 oneWay keys are read', () => {
    const mine = { ...V4_DEFAULTS, night: 350, waitMax: 1000 };
    expect(file({ oneWay: mine })?.outstation.oneWay).toEqual(mine);
  });

  test('the older keys (v2 driving days, v3 by the km) or odd values → the v4 settings', () => {
    const v2 = { driveDay: 1600, returnDay: 1600, returnHour: 160, driveHoursPerDay: 12, driveGraceHours: 1 };
    const v3 = { perKm: 3, homeHour: 100, homeDayMax: 1500, minimum: 1500, roundTo: 50 };
    expect(file({ oneWay: v2 })?.outstation.oneWay).toEqual(V4_DEFAULTS);
    expect(file({ oneWay: v3 })?.outstation.oneWay).toEqual(V4_DEFAULTS);
    expect(file({ oneWay: { ...V4_DEFAULTS, perKm: '2.5' } })?.outstation.oneWay).toEqual(V4_DEFAULTS);
  });

  test('no oneWay at all: the driver’s-time price, as before', () => {
    const plan = planTrip(DEFAULT_CONFIG, 'one-way-drop', 'Raipur', 'ranchi');
    expect(plan.est?.long).toBeUndefined();
    expect(plan.est?.time).toBeDefined();
  });

  test('trains.toStationMinutes is read; older files: 90', () => {
    expect(file({}, { toStationMinutes: 60 })?.trains.toStationMinutes).toBe(60);
    const old = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    delete old.trains.toStationMinutes;
    expect(parseAppConfig(old)?.trains.toStationMinutes).toBe(90);
  });
});

describe('the live meter', () => {
  const ts = (ms: number) => ({ toDate: () => new Date(ms) });
  const S = Date.parse('2026-11-24T01:30:00Z');
  const H = 3_600_000;
  const trip = (extra: Record<string, unknown>) =>
    toBooking('b1', {
      package: 'one-way-drop',
      status: 'assigned',
      trip: {
        to: 'Ranchi',
        destId: 'ranchi',
        kind: 'one-way',
        km: 616,
        days: 1,
        returnHours: 21,
        estFrom: 3350,
        estTo: 3350,
      },
      ...extra,
    });

  test('the estimate until his wait runs past it; then drop → boarded (or now)', () => {
    const drop = S + 12.5 * H;
    expect(tripMeter(trip({ clock: { startAt: ts(S) } }), CONFIG, S + 20 * H)).toMatchObject({
      amount: 3350,
    });
    // Waiting 15 h after the drop: 11 h × ₹100 = ₹1,100 → 2,627 + 1,100 = 3,727 → ₹3,750.
    expect(
      tripMeter(trip({ clock: { startAt: ts(S), dropAt: ts(drop) } }), CONFIG, drop + 15 * H),
    ).toMatchObject({
      amount: 3750,
      overBooked: true,
    });
    // Boarded 6 h after the drop: the wait stops there.
    const boarded = trip({ clock: { startAt: ts(S), dropAt: ts(drop), boardAt: ts(drop + 6 * H) } });
    expect(tripMeter(boarded, CONFIG, drop + 40 * H)).toMatchObject({ amount: 3350, overBooked: false });
  });

  test('a train chosen at the drop: the robot’s final price with it', () => {
    const drop = S + 12.5 * H;
    const chosen = trip({
      clock: { startAt: ts(S), dropAt: ts(drop) },
      returnChoice: { train: '18452', dep: ts(drop + 3 * H), at: ts(drop + H) },
      returnPrice: { price: 2650, waitCharge: 0, train: '18452', at: ts(drop + H) },
    });
    expect(tripMeter(chosen, CONFIG, drop + 2 * H)).toMatchObject({ amount: 2650, overBooked: false });
  });
});

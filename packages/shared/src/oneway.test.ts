/**
 * One-way drops farther than the first nearby tier (160 km), website rule of
 * 24 Nov 2026 (outstation.oneWay): driving days, then his way home. The same
 * cases as the website's tests; an older website file keeps the time price.
 */

import { toBooking } from './booking';
import { type AppConfig, DEFAULT_CONFIG, parseAppConfig } from './config';
import { tripMeter } from './meter';
import {
  chargeHours,
  isLongOneWay,
  longDrivingDays,
  longOneWayPrice,
  longReturn,
  planTrip,
  tripRecord,
} from './trip';

const ONE_WAY = {
  driveDay: 1600,
  returnDay: 1600,
  returnHour: 160,
  driveHoursPerDay: 12,
  driveGraceHours: 1,
};
const CONFIG: AppConfig = {
  ...DEFAULT_CONFIG,
  outstation: { ...DEFAULT_CONFIG.outstation, oneWay: ONE_WAY, graceMinutes: 15 },
};
const hm = (h: number, m = 0) => h * 60 + m;
const price = (km: number, drivingHours: number, returnMinutes: number) =>
  longOneWayPrice(CONFIG, km, drivingHours, returnMinutes)?.price;

describe('the five cases', () => {
  test('A: Raipur → Ranchi, 616 km, 12.3 h driving, 1 h wait + 9 h 40 m train → ₹3,200', () => {
    expect(price(616, 12.3, hm(10, 40))).toBe(3200);
    expect(price(616, 12.3, hm(10, 41))).toBe(3200);
    expect(longOneWayPrice(CONFIG, 616, 12.3, hm(10, 40))).toMatchObject({
      drivingDays: 1,
      returnFullDays: 0,
      returnLeftoverHours: 11, // 11 × ₹160 = ₹1,760, never more than ₹1,600
      returnCharge: 1600,
    });
  });

  test('B: 1,200 km, 24 h driving, 27 h home → 2 × ₹1,600 + ₹1,600 + 3 × ₹160 = ₹5,280', () => {
    expect(price(1200, 24, hm(27))).toBe(5280);
  });

  test('C: 1,200 km, 24 h driving, 35 h home → ₹3,200 + ₹1,600 + ₹1,600 (11 h, capped) = ₹6,400', () => {
    expect(price(1200, 24, hm(35))).toBe(6400);
  });

  test('D: 300 km, 6 h driving, 5 h home → ₹1,600 + 5 × ₹160 = ₹2,400', () => {
    expect(price(300, 6, hm(5))).toBe(2400);
  });

  test('E: 160 km or less stays the same-day price; so do round trips', () => {
    expect(isLongOneWay(CONFIG, 160)).toBe(false);
    expect(isLongOneWay(CONFIG, 161)).toBe(true);
    // Raipur → Bilaspur, 113 km: one price for the trip, as before.
    const near = planTrip(CONFIG, 'one-way-drop', 'Raipur', 'bilaspur');
    const before = planTrip(DEFAULT_CONFIG, 'one-way-drop', 'Raipur', 'bilaspur');
    expect(near.est?.long).toBeUndefined();
    expect(near.est).toEqual(before.est);
    expect(near.est?.time?.short).toBe(true);
    const round = planTrip(CONFIG, 'outstation', 'Raipur', 'ranchi');
    expect(round.est).toEqual(planTrip(DEFAULT_CONFIG, 'outstation', 'Raipur', 'ranchi').est);
  });
});

describe('the edges', () => {
  test('driving days: 12 h a day, the last up to 1 h longer, at least 1', () => {
    expect(longDrivingDays(ONE_WAY, 0)).toBe(1);
    expect(longDrivingDays(ONE_WAY, 13)).toBe(1);
    expect(longDrivingDays(ONE_WAY, 13.1)).toBe(2);
    expect(longDrivingDays(ONE_WAY, 24)).toBe(2);
    expect(longDrivingDays(ONE_WAY, 25)).toBe(2);
    expect(longDrivingDays(ONE_WAY, 25.1)).toBe(3);
    expect(longDrivingDays({ ...ONE_WAY, driveGraceHours: undefined }, 12.3)).toBe(2); // no grace sent: none
  });

  test('his way home in the estimate: each started hour; full days at the day rate', () => {
    expect(longReturn(ONE_WAY, hm(9))).toMatchObject({ leftoverHours: 9, charge: 1440 });
    expect(longReturn(ONE_WAY, hm(9, 1))).toMatchObject({ leftoverHours: 10, charge: 1600 });
    expect(longReturn(ONE_WAY, hm(0, 1))).toMatchObject({ leftoverHours: 1, charge: 160 });
    expect(longReturn(ONE_WAY, hm(24))).toMatchObject({ fullDays: 1, leftoverHours: 0, charge: 1600 });
    expect(longReturn(ONE_WAY, hm(23, 59))).toMatchObject({ fullDays: 0, charge: 1600 });
  });

  test('the bill (and the live meter): the first 15 minutes of an hour are free', () => {
    expect(chargeHours(hm(9, 15), 15)).toBe(9);
    expect(chargeHours(hm(9, 16), 15)).toBe(10);
    expect(longReturn(ONE_WAY, hm(5, 15), 15).charge).toBe(800);
    expect(longReturn(ONE_WAY, hm(5, 16), 15).charge).toBe(960);
  });
});

describe('the estimate on the booking screen', () => {
  test('Raipur → Ranchi with the route’s average way home: ₹3,200, written as the website writes it', () => {
    const plan = planTrip(CONFIG, 'one-way-drop', 'Raipur', 'ranchi');
    expect(plan.est).toMatchObject({ from: 3200, to: 3200, days: 1, dayRate: { from: 1600, to: 1600 } });
    expect(plan.est?.long).toMatchObject({ drivingDays: 1, drivingDay: 1600, returnCharge: 1600 });
    expect(plan.est?.time).toBeUndefined();
    expect(tripRecord(plan, '')).toMatchObject({
      km: 616,
      days: 1, // the driving days
      returnHours: plan.returnHours,
      estFrom: 3200,
      estTo: 3200,
    });
  });

  test('with the train picked: 1 h wait + 9 h 40 m ride → ₹3,200', () => {
    const typical = planTrip(CONFIG, 'one-way-drop', 'Raipur', 'ranchi');
    const dropAt = typical.dropAt ?? 0;
    const plan = planTrip(CONFIG, 'one-way-drop', 'Raipur', 'ranchi', 0, 7, false, {
      leaveAt: dropAt + 1,
      homeAt: dropAt + 1 + 9 + 40 / 60,
      waitHours: 1,
    });
    expect(plan.est?.long).toMatchObject({ returnMinutes: 640, returnLeftoverHours: 11, price: 3200 });
  });

  test('an older website file (no outstation.oneWay): the driver’s time, as before', () => {
    const plan = planTrip(DEFAULT_CONFIG, 'one-way-drop', 'Raipur', 'ranchi');
    expect(plan.est?.long).toBeUndefined();
    expect(plan.est?.time).toBeDefined();
    expect(tripRecord(plan, '').days).toBe(plan.days);
  });

  test('outstation.oneWay is read from the website file; odd or absent → left out', () => {
    const file = (oneWay: unknown) =>
      parseAppConfig({
        ...JSON.parse(JSON.stringify(DEFAULT_CONFIG)),
        outstation: { ...DEFAULT_CONFIG.outstation, oneWay },
      });
    expect(file(ONE_WAY)?.outstation.oneWay).toEqual(ONE_WAY);
    expect(file({ ...ONE_WAY, driveGraceHours: undefined })?.outstation.oneWay).toEqual({
      driveDay: 1600,
      returnDay: 1600,
      returnHour: 160,
      driveHoursPerDay: 12,
    });
    for (const odd of [undefined, 'x', { ...ONE_WAY, driveDay: '1600' }, { ...ONE_WAY, driveHoursPerDay: 0 }])
      expect(file(odd)?.outstation.oneWay).toBeUndefined();
  });
});

describe('the live meter', () => {
  const ts = (ms: number) => ({ toDate: () => new Date(ms) });
  const S = Date.parse('2026-11-24T01:30:00Z');
  const H = 3_600_000;
  const trip = (clock: Record<string, unknown>) =>
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
        estFrom: 3200,
        estTo: 3200,
      },
      clock,
    });

  test('driving from Start to the drop, then his way home from the drop, the bill’s grace', () => {
    // On time: 12 h 20 min driving, 10 h 41 min home → the estimate.
    expect(
      tripMeter(
        trip({ startAt: ts(S), dropAt: ts(S + 12.33 * H), homeAt: ts(S + 12.33 * H + 10.68 * H) }),
        CONFIG,
        S,
      ),
    ).toMatchObject({ amount: 3200, overBooked: false });
    // Still driving after 13 h 30 min: 2 driving days = ₹3,200, not more than booked yet.
    expect(tripMeter(trip({ startAt: ts(S) }), CONFIG, S + 13.5 * H)).toMatchObject({
      amount: 3200,
      overBooked: false,
    });
    // Dropped at 14 h, 5 h 15 min on his way home: + 5 × ₹160.
    const dropped = trip({ startAt: ts(S), dropAt: ts(S + 14 * H) });
    expect(tripMeter(dropped, CONFIG, S + 19.25 * H)).toMatchObject({ amount: 4000, overBooked: true });
    expect(tripMeter(dropped, CONFIG, S + 19.25 * H + 60_000)).toMatchObject({ amount: 4160 });
  });

  test('an older website file: the driver’s time in 24-hour blocks, as before', () => {
    // 3 days without a drop: 3 × ₹1,750 (the day price for 616 km) by the time rule …
    expect(tripMeter(trip({ startAt: ts(S) }), DEFAULT_CONFIG, S + 72 * H)).toMatchObject({ amount: 5250 });
    // … and 6 driving days by the new one.
    expect(tripMeter(trip({ startAt: ts(S) }), CONFIG, S + 72 * H)).toMatchObject({ amount: 9600 });
  });
});

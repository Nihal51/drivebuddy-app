/**
 * One-way drops farther than 160 km, v3 (website, 24 Nov 2026): the drive by
 * the km plus his way home, to the nearest ₹50, at least ₹1,500; the drive
 * timed with breaks. The same examples as the website; v2 and older config
 * files keep their pricing.
 */

import { toBooking } from './booking';
import { type AppConfig, DEFAULT_CONFIG, parseAppConfig } from './config';
import { tripMeter } from './meter';
import { kmOneWayPrice, planTrip, roadTime, toNearest, tripRecord } from './trip';

const V3 = { perKm: 3, homeHour: 100, homeDayMax: 1500, minimum: 1500, roundTo: 50 };
const DRIVE = { kmh: 55, breakEveryHours: 4, breakMinutes: 35, maxRoadHoursPerDay: 12 };
const V2 = { driveDay: 1600, returnDay: 1600, returnHour: 160, driveHoursPerDay: 12, driveGraceHours: 1 };
const withRules = (extra: Record<string, unknown>): AppConfig =>
  ({ ...DEFAULT_CONFIG, outstation: { ...DEFAULT_CONFIG.outstation, ...extra } }) as AppConfig;
const CONFIG = withRules({ oneWay: V3, drive: DRIVE, graceMinutes: 15 });
const hm = (h: number, m = 0) => h * 60 + m;
const price = (km: number, homeMinutes: number) => kmOneWayPrice(V3, km, homeMinutes).price;

describe('the four examples from Raipur', () => {
  test('Ambikapur 334 km, about 9 h home → 1,002 + 900 = 1,902 → ₹1,900', () => {
    expect(price(334, hm(9))).toBe(1900);
  });
  test('Prayagraj 578 km, about 15 h home → 1,734 + 1,500 (at most a day) = 3,234 → ₹3,250', () => {
    expect(price(578, hm(15))).toBe(3250);
  });
  test('Ranchi 616 km, 10 h 41 m home → 1,848 + 11 × 100 = 2,948 → ₹2,950', () => {
    expect(kmOneWayPrice(V3, 616, hm(10, 41))).toMatchObject({
      driving: 1848,
      homeLeftoverHours: 11,
      home: 1100,
      subtotal: 2948,
      price: 2950,
      adjust: 2,
      minimumApplies: false,
    });
  });
  test('Bengaluru 1,370 km, about 35 h home → 4,110 + 1,500 + 1,100 = 6,710 → ₹6,700', () => {
    expect(price(1370, hm(35))).toBe(6700);
    expect(price(1370, hm(34, 45))).toBe(6700);
  });

  test('the same from the route table (the route’s average way home)', () => {
    const est = (dest: string) => planTrip(CONFIG, 'one-way-drop', 'Raipur', dest).est;
    expect(est('ambikapur')).toMatchObject({ from: 1900, to: 1900 });
    expect(est('prayagraj')).toMatchObject({ from: 3250, to: 3250 });
    expect(est('bengaluru')).toMatchObject({ from: 6700, to: 6700 });
    // Ranchi's average wait is long (10 h 45 m + 10 h ride): a day's most, ₹3,350; with a train 10 h 41 m: ₹2,950.
    expect(est('ranchi')).toMatchObject({ from: 3350 });
    const dropAt = planTrip(CONFIG, 'one-way-drop', 'Raipur', 'ranchi').dropAt ?? 0;
    const train = planTrip(CONFIG, 'one-way-drop', 'Raipur', 'ranchi', 0, 7, false, {
      leaveAt: dropAt + 1,
      homeAt: dropAt + 10 + 41 / 60,
      waitHours: 1,
    });
    expect(train.est?.byKm).toMatchObject({ homeMinutes: 641, price: 2950 });
    expect(tripRecord(train, '')).toMatchObject({ km: 616, days: train.days, estFrom: 2950, estTo: 2950 });
  });
});

describe('the minimum and the rounding', () => {
  test('at least ₹1,500 when the drive and his way home come to less', () => {
    expect(kmOneWayPrice(V3, 200, hm(2))).toMatchObject({
      subtotal: 800,
      price: 1500,
      minimumApplies: true,
      adjust: 700,
    });
  });
  test('to the nearest ₹50, half way up', () => {
    expect(toNearest(2948, 50)).toBe(2950);
    expect(toNearest(3234, 50)).toBe(3250);
    expect(toNearest(1924, 50)).toBe(1900);
    expect(toNearest(1925, 50)).toBe(1950);
    expect(price(325, hm(9))).toBe(1900); // 975 + 900 = 1,875 → 1,900
  });
  test('his way home: each started hour, at most ₹1,500 for any 24 hours', () => {
    expect(kmOneWayPrice(V3, 300, hm(5)).home).toBe(500);
    expect(kmOneWayPrice(V3, 300, hm(5, 1)).home).toBe(600);
    expect(kmOneWayPrice(V3, 300, hm(23, 59)).home).toBe(1500);
    expect(kmOneWayPrice(V3, 300, hm(24)).home).toBe(1500);
    expect(kmOneWayPrice(V3, 300, hm(27)).home).toBe(1800);
  });
});

describe('config fallbacks', () => {
  const ranchi = (config: AppConfig) => planTrip(config, 'one-way-drop', 'Raipur', 'ranchi').est;

  test('v3 is read from the website file', () => {
    const file = parseAppConfig({
      ...JSON.parse(JSON.stringify(DEFAULT_CONFIG)),
      outstation: { ...DEFAULT_CONFIG.outstation, oneWay: V3, drive: DRIVE },
    });
    expect(file?.outstation.oneWay).toEqual(V3);
    expect(file?.outstation.drive).toEqual(DRIVE);
    // And read back from the phone's saved copy.
    expect(parseAppConfig(JSON.parse(JSON.stringify(file)))?.outstation.oneWay).toEqual(V3);
    for (const odd of [
      { ...V3, perKm: '3' },
      { ...V3, roundTo: 0 },
      { ...V3, minimum: -1 },
    ])
      expect(
        parseAppConfig({
          ...JSON.parse(JSON.stringify(DEFAULT_CONFIG)),
          outstation: { ...DEFAULT_CONFIG.outstation, oneWay: odd },
        })?.outstation.oneWay,
      ).toBeUndefined();
  });

  test('v2 rates still price by driving days; no rates: the driver’s time, as before', () => {
    expect(ranchi(withRules({ oneWay: V2 }))).toMatchObject({ from: 3200, long: { drivingDays: 1 } });
    expect(ranchi(withRules({ oneWay: V2 }))?.byKm).toBeUndefined();
    const old = ranchi(DEFAULT_CONFIG);
    expect(old?.byKm).toBeUndefined();
    expect(old?.long).toBeUndefined();
    expect(old?.time).toBeDefined();
  });

  test('160 km or less, and round trips: unchanged', () => {
    const near = (config: AppConfig) => planTrip(config, 'one-way-drop', 'Raipur', 'bilaspur').est;
    expect(near(CONFIG)?.from).toBe(near(DEFAULT_CONFIG)?.from);
    expect(near(CONFIG)?.byKm).toBeUndefined();
    const round = (config: AppConfig) => planTrip(config, 'outstation', 'Raipur', 'ranchi').est;
    expect(round(CONFIG)).toEqual(round(DEFAULT_CONFIG));
  });
});

describe('the drive, with breaks', () => {
  test('616 km at 55 km/h: 11 h 12 m driving + 2 breaks of 35 min → 12 h 22 m on the road', () => {
    const r = roadTime(DRIVE, 616);
    expect(r.driveHours).toBeCloseTo(11.2, 5);
    expect(r).toMatchObject({ breaks: 2 });
    expect(r.roadHours * 60).toBeCloseTo(11.2 * 60 + 70, 5);
    expect(roadTime(DRIVE, 200).breaks).toBe(0); // 3 h 38 m: no full 4 h yet
    expect(roadTime(DRIVE, 220).breaks).toBe(1); // exactly 4 h: one break
  });

  test('the plan: one day up to 13 h on the road, else the night’s rest — unless day and night', () => {
    const ranchi = planTrip(CONFIG, 'one-way-drop', 'Raipur', 'ranchi');
    expect(ranchi).toMatchObject({ breaks: 2, minDays: 1 });
    expect(ranchi.dropAt).toBeCloseTo(12 + 22 / 60, 2);
    // Bengaluru, 1,370 km: 24 h 55 m driving + 6 breaks (3 h 30 m) = 28 h 25 m on the road → rests 2 nights.
    const far = planTrip(CONFIG, 'one-way-drop', 'Raipur', 'bengaluru');
    expect(far).toMatchObject({ breaks: 6, minDays: 3 });
    expect(far.dropAt).toBeCloseTo(48 + (28 + 25 / 60 - 24), 1);
    const nonstop = planTrip(CONFIG, 'one-way-drop', 'Raipur', 'bengaluru', 0, 7, true);
    expect(nonstop.dropAt).toBeCloseTo(28 + 25 / 60, 1);
    // Without the drive rules: the route table's hours, no breaks.
    const old = planTrip(DEFAULT_CONFIG, 'one-way-drop', 'Raipur', 'ranchi');
    expect(old.breaks).toBeUndefined();
    expect(old.dropAt).toBeCloseTo(12.32, 5);
  });
});

describe('the live meter', () => {
  const ts = (ms: number) => ({ toDate: () => new Date(ms) });
  const S = Date.parse('2026-11-24T01:30:00Z');
  const H = 3_600_000;
  const M = 60_000;
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
        returnHours: 11,
        estFrom: 2950,
        estTo: 2950,
      },
      clock,
    });

  test('the drive is fixed once he starts; his way home from the drop, the bill’s 15 minutes free', () => {
    // Still driving: ₹1,848 → ₹1,850, under the estimate.
    expect(tripMeter(trip({ startAt: ts(S) }), CONFIG, S + 20 * H)).toMatchObject({
      amount: 2950,
      overBooked: false,
    });
    const drop = S + 12.5 * H;
    const dropped = trip({ startAt: ts(S), dropAt: ts(drop) });
    // 10 h 41 m home: 11 h → ₹2,950, as booked.
    expect(tripMeter(dropped, CONFIG, drop + 10 * H + 41 * M)).toMatchObject({
      amount: 2950,
      overBooked: false,
    });
    // 12 h 15 m: 12 h (the grace) → 1,848 + 1,200 = 3,048 → ₹3,050; 12 h 16 m: 13 h → ₹3,150.
    expect(tripMeter(dropped, CONFIG, drop + 12 * H + 15 * M)).toMatchObject({
      amount: 3050,
      overBooked: true,
    });
    expect(tripMeter(dropped, CONFIG, drop + 12 * H + 16 * M)).toMatchObject({ amount: 3150 });
    // Home: the clock stops there.
    const home = trip({ startAt: ts(S), dropAt: ts(drop), homeAt: ts(drop + 30 * H) });
    expect(tripMeter(home, CONFIG, drop + 90 * H)).toMatchObject({ amount: 3950 }); // 1,848 + 1,500 + 6 × 100 = 3,948
  });
});

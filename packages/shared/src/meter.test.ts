import { toBooking } from './booking';
import { DEFAULT_CONFIG } from './config';
import {
  LOCAL_BASE_HOURS,
  fareMeter,
  localMeter,
  localPackagePrice,
  minutesBetween,
  splitMinutes,
  tripMeter,
  usedHours,
} from './meter';
import { dayRateFor } from './trip';

const ts = (iso: string) => ({ toDate: () => new Date(iso) });
const START = '2026-11-24T04:00:00Z';
const at = (minutes: number) => Date.parse(START) + minutes * 60_000;
const CONFIG = { ...DEFAULT_CONFIG, prices: { ...DEFAULT_CONFIG.prices, twelveHours: 1400 } };
const local = (pkg: string, extra: Record<string, unknown> = {}) =>
  toBooking('b1', { package: pkg, status: 'assigned', clock: { startAt: ts(START) }, ...extra });

describe('hours used, as the robot bills them', () => {
  test('an hour counts only after 15 minutes: 3 h 15 min → 3, 3 h 16 min → 4', () => {
    expect(usedHours(3 * 60 + 15)).toBe(3);
    expect(usedHours(3 * 60 + 16)).toBe(4);
    expect(usedHours(15)).toBe(0);
    expect(usedHours(16)).toBe(1);
    expect(usedHours(0)).toBe(0);
    expect(usedHours(-30)).toBe(0);
    expect(minutesBetween(at(0), at(200) + 59_000)).toBe(200); // whole minutes
    expect(minutesBetween(at(10), at(0))).toBe(0); // a clock ahead never counts backwards
  });

  test('the hours in each package', () => {
    expect(LOCAL_BASE_HOURS).toEqual({
      '1-hour-300': 1,
      '3-hours-600': 3,
      'local-12-hours': 12,
      'local-full-day': 8,
      'night-driver': 10,
    });
  });
});

describe('local jobs', () => {
  test('3 hours: within the package, then each started hour past it', () => {
    expect(localMeter(local('3-hours-600'), CONFIG, at(3 * 60 + 15))).toEqual({
      kind: 'local',
      minutes: 195,
      baseHours: 3,
      usedHours: 3,
      extraHours: 0,
      extraHourRate: 150,
      packagePrice: 600,
      amount: 600,
    });
    expect(localMeter(local('3-hours-600'), CONFIG, at(3 * 60 + 16))).toMatchObject({
      usedHours: 4,
      extraHours: 1,
      amount: 750,
    });
  });

  test('full day (8 h, at the top of its range): 9 h 15 min → 1 extra hour, 9 h 20 min → 2', () => {
    // As the robot bills it (usedHours in apps-script/Code.js): the 10th hour counts once it is
    // more than 15 minutes old, so 9 h 20 min is 10 hours used.
    expect(localMeter(local('local-full-day'), CONFIG, at(9 * 60 + 15))).toMatchObject({
      minutes: 555,
      baseHours: 8,
      usedHours: 9,
      extraHours: 1,
      packagePrice: 1200,
      amount: 1350,
    });
    expect(localMeter(local('local-full-day'), CONFIG, at(9 * 60 + 20))).toMatchObject({
      minutes: 560,
      usedHours: 10,
      extraHours: 2,
      amount: 1500,
    });
  });

  test('12 hours: 12 included, then by the hour', () => {
    expect(localMeter(local('local-12-hours'), CONFIG, at(12 * 60 + 15))).toMatchObject({
      baseHours: 12,
      extraHours: 0,
      amount: 1400,
    });
    expect(localMeter(local('local-12-hours'), CONFIG, at(14 * 60 + 30))).toMatchObject({
      usedHours: 15,
      extraHours: 3,
      amount: 1400 + 3 * 150,
    });
  });

  test('the package price: agreed on the call → accepted → the site’s (night: its from-price)', () => {
    expect(localPackagePrice(local('night-driver'), CONFIG)).toBe(500);
    expect(localPackagePrice(local('local-full-day', { quote: QUOTE(1100) }), CONFIG)).toBe(1100);
    expect(localPackagePrice(local('3-hours-600', { acceptedPrice: { amount: 650 } }), CONFIG)).toBe(650);
    // 12 hours on a website file without its price: none, so no meter.
    expect(localPackagePrice(local('local-12-hours'), DEFAULT_CONFIG)).toBeNull();
    expect(localMeter(local('local-12-hours'), DEFAULT_CONFIG, at(60))).toBeNull();
  });

  test('no Arrived yet, or not a local package: no meter', () => {
    expect(localMeter(local('3-hours-600', { clock: null }), CONFIG, at(60))).toBeNull();
    expect(localMeter(local('wedding-event'), CONFIG, at(60))).toBeNull();
    expect(localMeter(local('monthly-basic'), CONFIG, at(60))).toBeNull();
  });
});

describe('trips', () => {
  const TRIP = {
    to: 'Nagpur',
    destId: 'nagpur',
    kind: 'one-way',
    km: 284,
    days: 1,
    returnHours: 8,
    estFrom: 1700,
    estTo: 1700,
  };
  const trip = (extra: Record<string, unknown> = {}) =>
    toBooking('b2', {
      package: 'one-way-drop',
      status: 'assigned',
      trip: TRIP,
      clock: { startAt: ts(START) },
      ...extra,
    });
  const dayRate = dayRateFor(CONFIG, 284).from; // ₹1,700 a day for Nagpur

  test('within the booked time: the estimate', () => {
    expect(dayRate).toBe(1700);
    expect(tripMeter(trip(), CONFIG, at(20 * 60))).toEqual({
      kind: 'trip',
      minutes: 1200,
      amount: 1700,
      overBooked: false,
    });
  });

  test('longer: 24-hour blocks at the day price, the hours past them by the hour, never more than a day more', () => {
    // 1 day 4 h → one block + 4 h × ₹130.
    expect(tripMeter(trip(), CONFIG, at(28 * 60))).toMatchObject({
      amount: 1700 + 4 * 130,
      overBooked: true,
    });
    // 1 day 20 h: 20 h × ₹130 is more than a day → two blocks.
    expect(tripMeter(trip(), CONFIG, at(44 * 60))).toMatchObject({ amount: 2 * 1700 });
    // 3 days.
    expect(tripMeter(trip(), CONFIG, at(72 * 60))).toMatchObject({ amount: 3 * 1700 });
  });

  test('home: the clock stops at Reached home', () => {
    const home = trip({ clock: { startAt: ts(START), homeAt: ts('2026-11-25T06:00:00Z') } });
    expect(tripMeter(home, CONFIG, at(5 * 24 * 60))).toMatchObject({
      minutes: 26 * 60,
      amount: 1700 + 2 * 130,
    });
  });

  test('the agreed price and day rate from the call count first', () => {
    const quoted = trip({ quote: { ...QUOTE(2000), dayRate: 1800, extraHourRate: 100 } });
    expect(tripMeter(quoted, CONFIG, at(10 * 60))).toMatchObject({ amount: 2000, overBooked: false });
    // 1 day 6 h at the call's rates: ₹1,800 + 6 × ₹100.
    expect(tripMeter(quoted, CONFIG, at(30 * 60))).toMatchObject({ amount: 2400, overBooked: true });
  });

  test('a place not in the list (no km): the booked estimate only; no estimate: time only', () => {
    expect(tripMeter(trip({ trip: { ...TRIP, km: 0 } }), CONFIG, at(60 * 60))).toMatchObject({
      amount: 1700,
      overBooked: false,
    });
    expect(tripMeter(trip({ trip: { ...TRIP, km: 0, estFrom: 0, estTo: 0 } }), CONFIG, at(60))).toEqual({
      kind: 'trip',
      minutes: 60,
      amount: null,
      overBooked: false,
    });
  });

  test('round trips too', () => {
    const round = toBooking('b3', {
      package: 'outstation',
      status: 'assigned',
      trip: { ...TRIP, kind: 'round', days: 2, estFrom: 3400, estTo: 3400 },
      clock: { startAt: ts(START) },
    });
    expect(tripMeter(round, CONFIG, at(40 * 60))).toMatchObject({ amount: 3400, overBooked: false });
    expect(tripMeter(round, CONFIG, at(3 * 24 * 60))).toMatchObject({ amount: 3 * 1700, overBooked: true });
  });
});

describe('only while the driver is on the job', () => {
  test('assigned only', () => {
    expect(fareMeter(local('3-hours-600'), CONFIG, at(60))?.kind).toBe('local');
    for (const status of ['new', 'confirmed', 'completed', 'cancelled'])
      expect(fareMeter(local('3-hours-600', { status }), CONFIG, at(60))).toBeNull();
  });

  test('minutes → days, hours, minutes', () => {
    expect(splitMinutes(560)).toEqual({ days: 0, hours: 9, minutes: 20 });
    expect(splitMinutes(28 * 60)).toEqual({ days: 1, hours: 4, minutes: 0 });
    expect(splitMinutes(-5)).toEqual({ days: 0, hours: 0, minutes: 0 });
  });
});

function QUOTE(amount: number) {
  return {
    amount,
    dayRate: amount,
    days: 1,
    returnHours: 0,
    returnHourRate: 0,
    returnCharge: 0,
    extraHours: 0,
    extraHourRate: 0,
    ticket: 0,
  };
}

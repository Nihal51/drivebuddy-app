import { DEFAULT_CONFIG } from './config';
import {
  ELSEWHERE,
  routePrice,
  POPULAR_DESTINATIONS,
  dayRateFor,
  daySpan,
  shortDriveCharge,
  isTripPackage,
  notesWithTrip,
  parseDestinations,
  parseTripRules,
  planTrip,
  dropTime,
  returnCost,
  searchDestinations,
  startHourOf,
  toBill,
  toClock,
  toQuote,
  toTrip,
  tripNote,
  tripRecord,
} from './trip';

const config = DEFAULT_CONFIG;
/** By the hours (the driving and the way home), before a longer drop's route price. */
const byHours = (p: { est?: { driving: { from: number; to: number }; returnCharge: number } }) => [
  (p.est?.driving.from ?? 0) + (p.est?.returnCharge ?? 0),
  (p.est?.driving.to ?? 0) + (p.est?.returnCharge ?? 0),
];

/* The worked examples agreed with the owner (website: scripts/outstation.test.mjs, 29 Oct 2026):
   each 12 h of driving is a day at ₹1,550–1,650, the rest ₹120 an hour, more than
   7 left over = one more day (a shorter drive: by the hour); the way home from the
   drop until he is home, waiting included: each 24 h ₹1,200, the rest ₹120 an hour,
   more than 6 = ₹1,200. The typical time home (the website looks up real trains). */

test('Raipur → Nagpur one-way: 6 h of driving + 6 h home, all by the hour — ₹1,440', () => {
  const p = planTrip(config, 'one-way-drop', 'Raipur', 'nagpur');
  expect([p.km, p.fullDays, p.extraHours, p.days, p.returnHours, p.local]).toEqual([284, 0, 6, 1, 6, false]);
  expect(byHours(p)).toEqual([1440, 1440]);
  // About 12 h away: the route price (website 1 Nov 2026) — at least ₹400 + ₹1,300.
  expect([p.est?.route?.awayHours, p.est?.from, p.est?.to]).toEqual([12, 1700, 1700]);
});

test('a drive shorter than a day, as on the website: ₹120 an hour, at least ₹600; his way home on top', () => {
  expect([1, 3, 4, 5, 6, 7].map((h) => shortDriveCharge(config, h).from)).toEqual([
    600, 600, 600, 600, 720, 840,
  ]);
  const { shortDriveMinimum: _m, ...old } = config.outstation;
  expect(shortDriveCharge({ ...config, outstation: old }, 3).from).toBe(360);
  const at = (id: string) => planTrip(config, 'one-way-drop', 'Raipur', id).est?.from;
  expect([at('bhilai'), at('bilaspur'), at('kawardha'), at('korba')]).toEqual([840, 960, 1080, 1200]);
  expect(byHours(planTrip(config, 'one-way-drop', 'Raipur', 'jharsuguda'))).toEqual([1560, 1560]);
  // Read from the website file (or the phone's saved copy, same name).
  expect(parseTripRules({ ...config.outstation, shortDriveMinimum: 600 })?.shortDriveMinimum).toBe(600);
  expect(parseTripRules({ ...old })?.shortDriveMinimum).toBeUndefined();
  expect(parseTripRules({ ...old, shortDriveMinimum: -5 })?.shortDriveMinimum).toBeUndefined();
});

/* Decided with the owner, 3 Nov 2026 (website lib/outstation.ts routePrice): the route
   price includes up to 6 h of waiting for his train; every hour more is charged like his
   way home — ₹120 an hour, more than 6 h in a day = ₹1,200 a day. */
test('waiting for his train: 6 h in the route price, every hour more like the way home (3 Nov 2026)', () => {
  const w = (wait: number) => routePrice(config, 1370, 81, wait);
  expect([w(0)?.price, w(6)?.price, w(7)?.price, w(10)?.price, w(20)?.price]).toEqual([
    6500, 6500, 6620, 6980, 7700,
  ]);
  expect(w(10)).toMatchObject({ waitHours: 10, extraWaitHours: 4, waitCharge: 480, by: 'km' });
  expect(w(31)?.price).toBe(6500 + 1200 + 120);
  expect(w(Number.NaN)?.price).toBe(6500);
  // The days-away floor already pays for the time: no waiting on top.
  expect(routePrice(config, 284, 30, 14)).toMatchObject({ price: 3000, by: 'days' });
  // Older website files lack the rule: no charge for waiting.
  const { routeFreeWaitHours: free, ...old } = config.outstation;
  expect(free).toBe(6);
  expect(routePrice({ outstation: old }, 1370, 81, 20)?.price).toBe(6500);
  // Read from the website file only with the rest of the route price, and only when sensible.
  expect(parseTripRules({ ...config.outstation })?.routeFreeWaitHours).toBe(6);
  expect(parseTripRules({ ...old })?.routeFreeWaitHours).toBeUndefined();
  expect(
    parseTripRules({ ...config.outstation, routeFreeWaitHours: 99 })?.routeFreeWaitHours,
  ).toBeUndefined();
  const { routeBase: _b, ...noRoute } = config.outstation;
  expect(parseTripRules({ ...noRoute })?.routeFreeWaitHours).toBeUndefined();
});

test('Raipur → Mumbai one-way: 22.4 h = 1 day + 11 h, more than 7 = 2 full days; 19 h home — ₹4,300–4,500', () => {
  const p = planTrip(config, 'one-way-drop', 'Raipur', 'mumbai');
  expect([p.fullDays, p.extraHours, p.days, p.returnHours]).toEqual([2, 0, 2, 19]);
  expect([p.est?.extraCharge, p.est?.returnCharge]).toEqual([0, 1200]);
  expect(byHours(p)).toEqual([4300, 4500]);
  // The route price: ₹350 + ₹4.5 × 1,118 km = ₹5,381 → ₹5,400.
  expect([p.est?.from, p.est?.to, p.est?.route?.by]).toEqual([5400, 5400, 'km']);
});

test('Raipur → Hyderabad: 15.6 h = 1 day + 4 h by the hour; 16 h home = a full day — ₹3,230–3,330', () => {
  const p = planTrip(config, 'one-way-drop', 'Raipur', 'hyderabad', 0, { hour: 9, weekday: 0 });
  expect([p.fullDays, p.extraHours, p.returnHours, p.startHour]).toEqual([1, 4, 16, 9]);
  expect(byHours(p)).toEqual([3230, 3330]);
  expect(p.est?.from).toBe(3850); // the route price: ₹350 + ₹4.5 × 780 km
  // The typical way home: an hour to the station, then on board; no timetable in the app.
  expect((p.leaveAt ?? 0) - (p.dropAt ?? 0)).toBeCloseTo(1);
});

test('Raipur → Bengaluru: 2 days + 4 h; 29 h home = 1 day + 5 h — ₹5,380–5,580', () => {
  const p = planTrip(config, 'one-way-drop', 'Raipur', 'bengaluru', 0, { hour: 7, weekday: 1 });
  expect([p.fullDays, p.extraHours, p.days, p.returnHours]).toEqual([2, 4, 3, 29]);
  expect([p.est?.returnCharge, ...byHours(p)]).toEqual([1800, 5380, 5580]);
  expect([p.est?.from, p.est?.to]).toEqual([6500, 6500]); // the route price: ₹6,515 → ₹6,500
  // Day and night: the same price, the car there a day sooner.
  const nonstop = planTrip(config, 'one-way-drop', 'Raipur', 'bengaluru', 0, { hour: 7.5, weekday: 4 }, true);
  expect([nonstop.days, nonstop.est?.from]).toEqual([2, 6500]);
  expect(nonstop.dropAt).toBeLessThan(p.dropAt ?? 0);
});

test('Raipur → Delhi: booked days count in full; never more than 60', () => {
  const p = planTrip(config, 'one-way-drop', 'Raipur', 'delhi');
  expect([p.fullDays, p.extraHours, p.returnHours, byHours(p)[0], p.est?.from]).toEqual([
    2, 1, 24, 4420, 5800,
  ]);
  const four = planTrip(config, 'one-way-drop', 'Raipur', 'delhi', 4);
  expect([four.days, four.fullDays, four.extraHours]).toEqual([4, 4, 0]);
  expect(planTrip(config, 'one-way-drop', 'Raipur', 'delhi', 500).days).toBe(60);
});

test('the route price of a longer drop, exactly as the website (1 Nov 2026)', () => {
  expect(routePrice(config, 284, 11)).toBeUndefined();
  expect(routePrice(config, 284, 12)).toEqual({
    price: 1700,
    waitHours: 0,
    extraWaitHours: 0,
    waitCharge: 0,
    days: 1,
    awayHours: 12,
    km: 284,
    by: 'days',
  });
  expect([routePrice(config, 334, 16)?.price, routePrice(config, 577, 25.5)?.price]).toEqual([1850, 3000]);
  expect([routePrice(config, 1214, 60)?.price, routePrice(config, 1370, 81)?.price]).toEqual([5800, 6500]);
  expect(routePrice(config, 0, 30)).toBeUndefined();
  const at = (id: string) => planTrip(config, 'one-way-drop', 'Raipur', id).est?.from;
  expect(['bhilai', 'bilaspur', 'korba', 'raigarh'].map(at)).toEqual([840, 960, 1200, 1320]);
  expect(
    [
      'nagpur',
      'jagdalpur',
      'ambikapur',
      'jabalpur',
      'visakhapatnam',
      'puri',
      'hyderabad',
      'mumbai',
      'delhi',
      'bengaluru',
    ].map(at),
  ).toEqual([1700, 1700, 1850, 2050, 2800, 3000, 3850, 5400, 5800, 6500]);
  // Round trips: the days only.
  expect(planTrip(config, 'outstation', 'Raipur', 'jabalpur').est).toMatchObject({ from: 3100 });
  // An older website file without it: by the hours; the set is read only whole.
  const {
    routeAfterHours: _a,
    routeBase: _b,
    routePerKm: _k,
    routeMinBase: _m,
    routeMinPerDay: _d,
    lateAfterHours: _l,
    ...old
  } = config.outstation;
  expect(planTrip({ ...config, outstation: old }, 'one-way-drop', 'Raipur', 'ambikapur').est?.from).toBe(
    2040,
  );
  expect(parseTripRules({ ...config.outstation })).toMatchObject({ routePerKm: 4.5, routeMinPerDay: 1300 });
  expect(parseTripRules({ ...config.outstation, routePerKm: -1 })?.routeBase).toBeUndefined();
});

test('an older website file without the full-day rules: the leftover hours stay by the hour', () => {
  const { extraFullDayAfter: _e, returnFullDayAfter: _r, ...rules } = config.outstation;
  const p = planTrip({ ...config, outstation: rules }, 'one-way-drop', 'Raipur', 'mumbai');
  expect([p.fullDays, p.extraHours, p.est?.extraCharge]).toEqual([1, 11, 1320]);
});

test('day and night: the same driving price, an earlier drop', () => {
  const normal = planTrip(config, 'one-way-drop', 'Raipur', 'mumbai');
  const nonstop = planTrip(config, 'one-way-drop', 'Raipur', 'mumbai', 0, 7, true);
  expect(nonstop.nonstop).toBe(true);
  expect([nonstop.fullDays, nonstop.extraHours]).toEqual([normal.fullDays, normal.extraHours]);
  expect(nonstop.dropAt).toBeLessThan(normal.dropAt ?? 0);
  expect(dropTime(12, 13.5)).toBe(25.5);
  expect(dropTime(12, 12.5)).toBe(12.5);
  expect(dropTime(12, 22.4, true)).toBe(22.4);
});

test('the same answer as the website table for a 7 AM start, for every place and city', () => {
  for (const d of config.destinations)
    for (const city of ['Raipur', 'Bhilai', 'Durg', 'Bilaspur'] as const) {
      const p = planTrip(config, 'one-way-drop', city, d.id);
      if (p.sameCity) continue;
      expect([d.id, city, p.returnHours, p.days]).toEqual([
        d.id,
        city,
        d.from[city].oneWay.returnHours,
        d.from[city].oneWay.days,
      ]);
    }
});

test('an older website file without the timings: the table figure', () => {
  const old = {
    ...config,
    destinations: config.destinations.map((d) => ({
      ...d,
      from: Object.fromEntries(
        Object.entries(d.from).map(([c, l]) => [
          c,
          { ...l, oneWay: { days: l.oneWay.days, returnHours: l.oneWay.returnHours } },
        ]),
      ) as typeof d.from,
    })),
  };
  const p = planTrip(old, 'one-way-drop', 'Raipur', 'mumbai', 0, 22);
  const table = config.destinations.find((d) => d.id === 'mumbai')!.from.Raipur.oneWay.returnHours;
  expect([p.returnHours, p.dropAt, p.fullDays, p.extraHours]).toEqual([table, undefined, 2, 0]);
});

test('the way home: ₹120 an hour, at most ₹1,200 in any 24 hours', () => {
  expect(returnCost(0, 120, 1200)).toBe(0);
  expect(returnCost(6, 120, 1200)).toBe(720);
  expect(returnCost(27, 120, 1200)).toBe(1560);
  expect(returnCost(38, 120, 1200)).toBe(2400);
  expect(returnCost(Number.NaN, 120, 1200)).toBe(0);
});

test('the stored preferred time gives the start hour', () => {
  expect(startHourOf('2026-11-03T09:30')).toBe(9.5);
  expect(startHourOf('')).toBeUndefined();
  expect(startHourOf('soon')).toBeUndefined();
});

test('a round trip is the days of the trip; back home within the 24 hours is one day', () => {
  const p = planTrip(config, 'outstation', 'Raipur', 'nagpur');
  expect([p.kind, p.days, p.fullDays, p.returnHours]).toEqual(['round', 1, 1, 0]);
  // Nagpur is 284 km away: the day price up to 300 km.
  expect([p.est?.from, p.est?.to]).toEqual([1450, 1550]);
  expect(planTrip(config, 'outstation', 'Raipur', 'jharsuguda').days).toBe(1);
  expect(planTrip(config, 'outstation', 'Raipur', 'jabalpur').days).toBe(2);
  expect(planTrip(config, 'outstation', 'Raipur', 'delhi').days).toBe(4);
});

test('from another pickup city the table has its own distance', () => {
  expect(planTrip(config, 'one-way-drop', 'Bilaspur', 'raipur').km).toBe(110);
});

test('nearby, the same city, somewhere else, or no city yet', () => {
  expect(planTrip(config, 'outstation', 'Raipur', 'bhilai').local).toBe(true);
  const same = planTrip(config, 'outstation', 'Raipur', 'raipur');
  expect([same.sameCity, same.est]).toEqual([true, undefined]);
  const other = planTrip(config, 'one-way-drop', 'Raipur', ELSEWHERE, 2);
  expect([other.dest, other.km, other.days, other.est]).toEqual([undefined, 0, 2, undefined]);
  expect(planTrip(config, 'one-way-drop', '', 'nagpur').est).toBeUndefined();
});

test('prices follow the downloaded config', () => {
  const dearer = { ...config, prices: { ...config.prices, outstation: { from: 1600, to: 1700 } } };
  expect(planTrip(dearer, 'outstation', 'Raipur', 'jharsuguda').est?.from).toBe(1600);
  const flat = { ...config, prices: { ...config.prices, outstationNear: [] } };
  expect(planTrip(flat, 'outstation', 'Raipur', 'nagpur').est?.from).toBe(1550);
});

test('the day price by distance, as on the website: nearer places cost less a day', () => {
  // Up to 150 km ₹1,300–1,400; up to 300 km ₹1,450–1,550; farther ₹1,550–1,650.
  expect(dayRateFor(config, 113)).toEqual({ from: 1300, to: 1400 });
  expect(dayRateFor(config, 150)).toEqual({ from: 1300, to: 1400 });
  expect(dayRateFor(config, 151)).toEqual({ from: 1450, to: 1550 });
  expect(dayRateFor(config, 301)).toEqual({ from: 1550, to: 1650 });
  expect(dayRateFor(config, 0)).toEqual({ from: 1550, to: 1650 });
  expect(daySpan(config)).toEqual({ from: 1300, to: 1650 });
  const bilaspur = planTrip(config, 'outstation', 'Raipur', 'bilaspur');
  expect([bilaspur.days, bilaspur.est?.from, bilaspur.est?.to]).toEqual([1, 1300, 1400]);
  expect(planTrip(config, 'outstation', 'Raipur', 'bilaspur', 3).est?.from).toBe(3900);
  expect(planTrip(config, 'outstation', 'Raipur', 'jabalpur').est?.from).toBe(3100);
  // From Bilaspur, Raipur is close by.
  expect(planTrip(config, 'outstation', 'Bilaspur', 'raipur').est?.from).toBe(1300);
  // One-way: a short drop stays by the hour.
  expect(planTrip(config, 'one-way-drop', 'Raipur', 'bilaspur').est?.from).toBe(960);
});

test('the saved trip', () => {
  const t = tripRecord(planTrip(config, 'one-way-drop', 'Raipur', ELSEWHERE), '  Jaipur   city ');
  expect(t).toEqual({
    to: 'Jaipur city',
    destId: '',
    kind: 'one-way',
    km: 0,
    days: 1,
    returnHours: 0,
    estFrom: 0,
    estTo: 0,
  });
  expect(toTrip(t)).toEqual(t);
});

test('read back defensively', () => {
  expect(toTrip(null)).toBeUndefined();
  expect(toTrip({ to: '' })).toBeUndefined();
  expect(toTrip({ to: 'Nagpur', km: 1.5, days: 1, returnHours: 0, estFrom: 0, estTo: 0 })).toBeUndefined();
  expect(toQuote({ amount: 100 })).toBeUndefined();
  // A short drive's quote carries its charge (₹600 for 3 h); older quotes do not.
  const q = {
    amount: 960,
    dayRate: 1400,
    days: 0,
    returnHours: 3,
    returnHourRate: 120,
    returnCharge: 360,
    extraHours: 3,
    extraHourRate: 120,
    ticket: 0,
  };
  expect(toQuote({ ...q, extraCharge: 600 })?.extraCharge).toBe(600);
  expect(toQuote(q)?.extraCharge).toBeUndefined();
  // A route price (1 Nov 2026): the hours away and the km.
  expect(toQuote({ ...q, awayHours: 60, km: 1214 })).toMatchObject({ awayHours: 60, km: 1214 });
  expect(toQuote(q)).not.toHaveProperty('awayHours');
});

test('which packages carry a trip', () => {
  expect(isTripPackage('outstation')).toBe(true);
  expect(isTripPackage('one-way-drop')).toBe(true);
  expect(isTripPackage('3-hours-600')).toBe(false);
  expect(isTripPackage('toString')).toBe(false);
});

test('search: popular places first, then by name in English or Hindi', () => {
  const popular = searchDestinations(config.destinations, '');
  expect(popular.map((d) => d.id)).toEqual([...POPULAR_DESTINATIONS]);
  expect(searchDestinations(config.destinations, 'nag')[0]?.id).toBe('nagpur');
  expect(searchDestinations(config.destinations, 'नाग')[0]?.id).toBe('nagpur');
  expect(searchDestinations(config.destinations, 'pur').map((d) => d.id)).toContain('jabalpur');
  expect(searchDestinations(config.destinations, 'zzz')).toEqual([]);
});

test('the trip as a line for the team, and in the notes when the website does not take trips yet', () => {
  const t = tripRecord(planTrip(config, 'one-way-drop', 'Raipur', 'delhi'), '');
  const line = 'Trip: Raipur → Delhi · one-way drop · ~1214 km · 2 days + 24 h getting home · est. ₹5,800';
  expect(tripNote(t, 'Raipur')).toBe(line);
  expect(notesWithTrip('  Swift, automatic ', t, 'Raipur')).toBe(`${line}\nSwift, automatic`);
  expect(notesWithTrip('', t, 'Raipur')).toBe(line);
  expect(notesWithTrip('x'.repeat(500), t, 'Raipur')).toHaveLength(500);
  const other = tripRecord(planTrip(config, 'outstation', 'Durg', ELSEWHERE, 3), 'Jaipur');
  expect(tripNote(other, 'Durg')).toBe(
    'Trip: Durg → Jaipur (not in our list) · round trip · 3 days · quote on the call',
  );
  const big = { ...t, estFrom: 125000, estTo: 125000 };
  expect(tripNote(big, 'Raipur')).toContain('est. ₹1,25,000');
});

test('the published table is read with its timings; odd ones are dropped, never the table', () => {
  const json = JSON.parse(JSON.stringify(config.destinations));
  const parsed = parseDestinations(json);
  expect(parsed).toEqual(config.destinations);
  const delhi = json.find((d: { id: string }) => d.id === 'delhi');
  // An older website file still lists trains: read, and left out.
  delhi.trains = [{ no: '18238', name: 'Chhattisgarh Exp', dep: '13:00', hours: 23 }];
  delhi.from.Raipur.oneWay.homeHours = -1;
  const again = parseDestinations(json);
  const d = again?.find((x) => x.id === 'delhi');
  expect(d && 'trains' in d).toBe(false);
  expect(d?.from.Raipur.oneWay.driveHours).toBeUndefined();
  expect(d?.from.Raipur.oneWay.returnHours).toBe(
    config.destinations.find((x) => x.id === 'delhi')?.from.Raipur.oneWay.returnHours,
  );
  const rules = {
    hoursPerDay: 12,
    extraHour: 120,
    returnHour: 120,
    returnMaxPerDay: 1200,
    mealAllowance: 300,
    kmPerDay: 600,
    localWithinKm: 60,
  };
  expect(parseTripRules(rules)?.stationHours).toBeUndefined();
  expect(parseTripRules({ ...rules, stationHours: 1 })?.stationHours).toBe(1);
  expect(parseTripRules({ ...rules, averageKmh: 50 })?.averageKmh).toBe(50);
  // The full-day rules, as the website publishes them (or as the phone saved them).
  const r = parseTripRules({ ...rules, returnFullDayAfterHours: 6, extraFullDayAfterHours: 7 });
  expect([r?.returnFullDayAfter, r?.extraFullDayAfter]).toEqual([6, 7]);
  expect(parseTripRules({ ...rules, returnFullDayAfter: 6 })?.returnFullDayAfter).toBe(6);
  expect(parseTripRules({ ...rules, returnFullDayAfterHours: 30 })?.returnFullDayAfter).toBeUndefined();
});

/* The final bill and the trip times (website: lib/tripclock.ts, firestore.rules isBill / isClock). */

test('the final bill and the trip times are read back defensively', () => {
  const bill = {
    amount: 6200,
    dayRate: 1600,
    days: 2,
    extraHours: 5,
    extraHourRate: 120,
    extraCharge: 600,
    returnHours: 38,
    returnHourRate: 120,
    returnCharge: 2400,
    ticket: 0,
    nonstop: true,
    at: { toDate: () => new Date() },
  };
  expect(toBill(bill)).toEqual({
    amount: 6200,
    dayRate: 1600,
    days: 2,
    extraHours: 5,
    extraHourRate: 120,
    extraCharge: 600,
    returnHours: 38,
    returnHourRate: 120,
    returnCharge: 2400,
    ticket: 0,
    nonstop: true,
  });
  expect(toBill({ ...bill, extraCharge: '600' })).toBeUndefined();
  expect(toBill({ ...bill, amount: 0 })).toBeUndefined();
  expect(toBill(null)).toBeUndefined();

  const start = new Date('2026-10-29T02:15:00Z');
  const drop = new Date('2026-10-30T07:10:00Z');
  expect(toClock({ startAt: { toDate: () => start }, dropAt: drop })).toEqual({
    startAt: start,
    dropAt: drop,
  });
  expect(toClock({ dropAt: drop })).toBeUndefined(); // no start, no clock
  expect(toClock('x')).toBeUndefined();
});

test('the way home: each 24 h a day; up to 6 h left over by the hour, more = a full day (website rule, 29 Oct 2026)', () => {
  const c = (h: number) => returnCost(h, 120, 1200, 6);
  expect([0, 5, 6, 7, 8, 24, 30, 31, 32, 56].map(c)).toEqual([
    0, 600, 720, 1200, 1200, 1200, 1920, 2400, 2400, 3600,
  ]);
  // An older website file without the setting: the old rule.
  expect(returnCost(8, 120, 1200)).toBe(960);
  expect(
    parseTripRules({ ...DEFAULT_CONFIG.outstation, returnFullDayAfterHours: 6 })?.returnFullDayAfter,
  ).toBe(6);
  expect(
    parseTripRules({ ...DEFAULT_CONFIG.outstation, returnFullDayAfterHours: 99 })?.returnFullDayAfter,
  ).toBeUndefined();
});

test('driving: more than 7 hours left over after the full days count as one more day (website rule, 29 Oct 2026)', () => {
  const p = planTrip(config, 'one-way-drop', 'Raipur', 'mumbai'); // 22.4 h = 1 day + 11 h → 2 days
  expect([p.fullDays, p.extraHours]).toEqual([2, 0]);
  const n = planTrip(config, 'one-way-drop', 'Raipur', 'nagpur'); // 6 h: by the hour
  expect([n.fullDays, n.extraHours]).toEqual([0, 6]);
});

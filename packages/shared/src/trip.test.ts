import { DEFAULT_CONFIG } from './config';
import {
  ELSEWHERE,
  POPULAR_DESTINATIONS,
  dayRateFor,
  daySpan,
  isTripPackage,
  notesWithTrip,
  parseDestinations,
  parseTripRules,
  planTrip,
  pricedByTime,
  dropTime,
  searchDestinations,
  startHourOf,
  timeBlocks,
  timePrice,
  toBill,
  toClock,
  toQuote,
  toTrip,
  tripNote,
  tripRecord,
} from './trip';

const config = DEFAULT_CONFIG;
const at = (id: string, city: 'Raipur' | 'Bhilai' | 'Durg' | 'Bilaspur' = 'Raipur') =>
  planTrip(config, 'one-way-drop', city, id);

/* Decided with the owner, 8 Nov 2026 (website: lib/outstation.ts timePrice, scripts/outstation.test.mjs):
   a one-way drop is priced by the driver's TIME, from when he leaves until he is home — the drive,
   the route's average wait for his train and ride home (the train itself once picked). Each 24 hours
   is the day price for the distance; the hours past them ₹130 each, never more than one more day.
   Up to 160 km he is home the same day: one price for the trip. */

test('the day price rises with the distance, exactly as the website', () => {
  // ₹1,050 up to 60 km, rising to ₹1,350 at 160 km; then ₹1,450 rising to ₹1,750 at 300 km.
  expect([40, 60, 113, 127, 160].map((km) => dayRateFor(config, km).from)).toEqual([
    1050, 1050, 1200, 1250, 1350,
  ]);
  expect([161, 201, 216, 258, 284, 300, 1214].map((km) => dayRateFor(config, km).from)).toEqual([
    1450, 1550, 1550, 1650, 1700, 1750, 1750,
  ]);
  expect(dayRateFor(config, 113)).toEqual({ from: 1200, to: 1200 });
  // A place not in the list: the whole span, as a range.
  expect(dayRateFor(config, 0)).toEqual({ from: 1050, to: 1750 });
  expect(daySpan(config)).toEqual({ from: 1050, to: 1750 });
  // An older website file (no nearFromKm): each tier's from–to as a range.
  const { nearFromKm: _n, ...old } = config.outstation;
  const older = { ...config, outstation: old };
  expect([dayRateFor(older, 113), dayRateFor(older, 284)]).toEqual([
    { from: 1050, to: 1350 },
    { from: 1450, to: 1750 },
  ]);
  // No nearby tiers at all: the far price, rising from nearFromKm.
  const flat = { ...config, prices: { ...config.prices, outstationNear: [] } };
  expect([dayRateFor(flat, 60), dayRateFor(flat, 300)]).toEqual([
    { from: 1450, to: 1450 },
    { from: 1750, to: 1750 },
  ]);
  const flatOld = { ...flat, outstation: old };
  expect(dayRateFor(flatOld, 300)).toEqual({ from: 1450, to: 1750 });
  // dayTopFromKm left out: the top price straight after the last tier.
  const { dayTopFromKm: _t, ...noTop } = config.outstation;
  expect(dayRateFor({ ...config, outstation: noTop }, 200).from).toBe(1750);
});

test('24-hour blocks: the hours past them by the hour, never more than one more day', () => {
  expect([1, 24, 25, 37, 38, 48, 49].map((h) => timeBlocks(h, 1750, 130))).toEqual([
    { days: 1, extraHours: 0 },
    { days: 1, extraHours: 0 },
    { days: 1, extraHours: 1 },
    { days: 1, extraHours: 13 }, // 13 × ₹130 = ₹1,690, under a day
    { days: 2, extraHours: 0 }, // 14 × ₹130 = ₹1,820: one more day instead
    { days: 2, extraHours: 0 },
    { days: 2, extraHours: 1 },
  ]);
  expect(timeBlocks(Number.NaN, 1750, 130)).toEqual({ days: 1, extraHours: 0 });
  // The worked examples: Visakhapatnam 26 h; Delhi 66 h = 2 × 24 h + 18 h → 3 days.
  expect(timePrice(config, 546, 25.2)).toMatchObject({
    days: 1,
    extraHours: 2,
    extraCharge: 260,
    price: 2010,
  });
  expect(timePrice(config, 1214, 66)).toMatchObject({ days: 3, extraHours: 0, price: 5250 });
  // A same-day drop: one price, and still 24-hour blocks if he is away longer.
  expect(timePrice(config, 113, 6)).toMatchObject({ short: true, days: 1, price: 1200 });
  expect(timePrice(config, 113, 27)).toMatchObject({ short: true, days: 1, extraHours: 3, price: 1590 });
  // The agreed rates on a quote, and an unknown place.
  expect(timePrice(config, 546, 26, { dayRate: 1600, extraHour: 120 })?.price).toBe(1840);
  expect(timePrice(config, 0, 30)).toBeUndefined();
});

test('one-way drops from Raipur at 7 AM: the same prices as the website', () => {
  const price = (id: string) => at(id).est?.from;
  expect(
    ['bilaspur', 'kanker', 'janjgir', 'korba', 'raigarh', 'nagpur', 'jharsuguda', 'jabalpur'].map(price),
  ).toEqual([1200, 1250, 1350, 1550, 1650, 1700, 1750, 1750]);
  expect(
    [
      'visakhapatnam',
      'bhubaneswar',
      'puri',
      'ranchi',
      'bhopal',
      'varanasi',
      'hyderabad',
      'kolkata',
      'lucknow',
      'pune',
      'mumbai',
      'delhi',
      'bengaluru',
      'chennai',
    ].map(price),
  ).toEqual([2010, 2920, 3180, 3050, 3050, 3440, 3890, 3500, 5250, 5250, 4670, 5250, 7000, 6810]);
  // One number, not a range.
  const p = at('mumbai');
  expect(p.est?.from).toBe(p.est?.to);
  expect(p.est?.time).toMatchObject({ days: 2, extraHours: 9, dayRate: 1750, extraHourRate: 130 });
});

test('Raipur → Nagpur: the drive, the route’s average wait and ride — one 24-hour block', () => {
  const p = at('nagpur');
  expect([p.km, p.days, p.local]).toEqual([284, 1, false]);
  // 5.7 h of driving, 2.5 h average wait, 4.75 h home: about 13 h, inside the 24.
  expect((p.leaveAt ?? 0) - (p.dropAt ?? 0)).toBeCloseTo(2.5);
  expect(p.est?.time).toMatchObject({ hours: 13, days: 1, extraHours: 0, price: 1700, short: false });
  expect(p.est).toMatchObject({ from: 1700, to: 1700, days: 1, dayRate: { from: 1700, to: 1700 } });
});

test('Raipur → Bilaspur: home the same day, one price for the trip', () => {
  const p = at('bilaspur');
  expect(p.est?.time).toMatchObject({ short: true, days: 1, price: 1200 });
  // Bhilai → Raipur: close by, the lowest price.
  expect(at('raipur', 'Bhilai').est?.from).toBe(1050);
});

test('the train picked replaces the average: a late one past the 24 h costs by the hour', () => {
  const typical = at('visakhapatnam');
  const drop = typical.dropAt!;
  const train = (wait: number, ride: number) =>
    planTrip(config, 'one-way-drop', 'Raipur', 'visakhapatnam', 0, 7, false, {
      leaveAt: drop + wait,
      homeAt: drop + wait + ride,
      waitHours: wait,
    });
  // 11 h drive + 2 h wait + 9 h ride = 22 h: inside the 24.
  expect(train(2, 9).est?.from).toBe(1750);
  // 11 h + 8 h + 9 h = 28 h: 4 h past × ₹130.
  expect(train(8, 9).est?.time).toMatchObject({ hours: 28, extraHours: 4, price: 2270 });
  expect(train(8, 9).waitHours).toBe(8);
});

test('Raipur → Delhi: booked days count in full; never more than 60', () => {
  const p = at('delhi');
  expect([p.fullDays, p.extraHours, p.est?.from]).toEqual([2, 1, 5250]);
  const four = planTrip(config, 'one-way-drop', 'Raipur', 'delhi', 4);
  expect([four.days, four.fullDays, four.extraHours]).toEqual([4, 4, 0]);
  // Two days' stop on the way: he is away two days longer.
  expect(four.est?.time?.hours).toBe((p.est?.time?.hours ?? 0) + 48);
  expect(planTrip(config, 'one-way-drop', 'Raipur', 'delhi', 500).days).toBe(60);
});

test('day and night: the car there sooner, and he is home sooner', () => {
  const normal = at('bengaluru');
  const nonstop = planTrip(config, 'one-way-drop', 'Raipur', 'bengaluru', 0, { hour: 7.5, weekday: 4 }, true);
  expect(nonstop.nonstop).toBe(true);
  expect(nonstop.dropAt).toBeLessThan(normal.dropAt ?? 0);
  expect(nonstop.est?.from).toBeLessThan(normal.est?.from ?? 0);
  expect(dropTime(12, 13.5)).toBe(25.5);
  expect(dropTime(12, 12.5)).toBe(12.5);
  expect(dropTime(12, 22.4, true)).toBe(22.4);
});

test('an older website file without the average wait: an hour at the station', () => {
  const noWait = {
    ...config,
    destinations: config.destinations.map((d) => ({
      ...d,
      from: Object.fromEntries(
        Object.entries(d.from).map(([c, l]) => {
          const { wait: _w, ...oneWay } = l.oneWay;
          return [c, { ...l, oneWay }];
        }),
      ) as typeof d.from,
    })),
  };
  const p = planTrip(noWait, 'one-way-drop', 'Raipur', 'nagpur');
  expect((p.leaveAt ?? 0) - (p.dropAt ?? 0)).toBeCloseTo(1);
  const { stationHours: _s, ...noStation } = config.outstation;
  const q = planTrip({ ...noWait, outstation: noStation }, 'one-way-drop', 'Raipur', 'nagpur');
  expect((q.leaveAt ?? 0) - (q.dropAt ?? 0)).toBeCloseTo(1);
});

test('an older website file without the full-day rule: the leftover driving hours stay by the hour', () => {
  const { extraFullDayAfter: _e, ...rules } = config.outstation;
  const p = planTrip({ ...config, outstation: rules }, 'one-way-drop', 'Raipur', 'mumbai');
  expect([p.fullDays, p.extraHours]).toEqual([1, 11]);
  // The price is for his time either way.
  expect(p.est?.from).toBe(at('mumbai').est?.from);
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

test('an older website file without the timings: the table figure, and his time from it', () => {
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
  // Leaving at 10 PM: the drive (22.4 h, resting the night) and the table's hours home.
  expect(p.est?.time?.hours).toBe(Math.ceil(dropTime(12, 1118 / 50) + table));
});

test('the stored preferred time gives the start hour', () => {
  expect(startHourOf('2026-11-03T09:30')).toBe(9.5);
  expect(startHourOf('')).toBeUndefined();
  expect(startHourOf('soon')).toBeUndefined();
});

test('a round trip is the days of the trip; back home within the 24 hours is one day', () => {
  const p = planTrip(config, 'outstation', 'Raipur', 'nagpur');
  expect([p.kind, p.days, p.fullDays, p.returnHours]).toEqual(['round', 1, 1, 0]);
  // Nagpur is 284 km away: ₹1,700 a day.
  expect(p.est).toEqual({ from: 1700, to: 1700, days: 1, dayRate: { from: 1700, to: 1700 } });
  // Surat-like long trips: 7 days at the top price.
  expect(planTrip(config, 'outstation', 'Raipur', 'mumbai', 7).est?.from).toBe(7 * 1750);
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
  const dearer = { ...config, prices: { ...config.prices, outstation: { from: 1600, to: 1800 } } };
  expect(planTrip(dearer, 'outstation', 'Raipur', 'jharsuguda').est?.from).toBe(1800);
  const cheaperHour = { ...config, outstation: { ...config.outstation, extraHour: 100 } };
  expect(planTrip(cheaperHour, 'one-way-drop', 'Raipur', 'mumbai').est?.from).toBe(3500 + 9 * 100);
});

test('round trips: the day price for the distance, a day at a time', () => {
  const bilaspur = planTrip(config, 'outstation', 'Raipur', 'bilaspur');
  expect([bilaspur.days, bilaspur.est?.from, bilaspur.est?.to]).toEqual([1, 1200, 1200]);
  expect(planTrip(config, 'outstation', 'Raipur', 'bilaspur', 3).est?.from).toBe(3600);
  expect(planTrip(config, 'outstation', 'Raipur', 'jabalpur').est?.from).toBe(3500);
  // From Bilaspur, Raipur is close by.
  expect(planTrip(config, 'outstation', 'Bilaspur', 'raipur').est?.from).toBe(1200);
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
  // The driver's time (8 Nov 2026): the km, no route hours, no way-home charge.
  const time = {
    ...q,
    amount: 4670,
    dayRate: 1750,
    days: 2,
    extraHours: 9,
    extraHourRate: 130,
    returnHours: 0,
    returnCharge: 0,
    returnHourRate: 0,
    km: 1118,
  };
  expect(pricedByTime(toQuote(time)!)).toBe(true);
  expect(pricedByTime(toQuote({ ...time, awayHours: 60 })!)).toBe(false);
  expect(pricedByTime(q)).toBe(false);
  expect(pricedByTime({ ...q, km: 1118 })).toBe(false);
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
  const p = planTrip(config, 'one-way-drop', 'Raipur', 'delhi');
  const line = `Trip: Raipur → Delhi · one-way drop · ~1214 km · 2 days + ${p.returnHours} h getting home · est. ₹5,250`;
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
  // The average wait (8 Nov 2026) is read with the other timings; an odd one is dropped alone.
  expect(d?.from.Raipur.oneWay.wait).toBeUndefined();
  expect(again?.find((x) => x.id === 'nagpur')?.from.Raipur.oneWay.wait).toBe(2.5);
  json.find((x: { id: string }) => x.id === 'nagpur').from.Raipur.oneWay.wait = 'soon';
  const nagpur = parseDestinations(json)?.find((x) => x.id === 'nagpur')?.from.Raipur.oneWay;
  expect([nagpur?.wait, nagpur?.homeHours]).toEqual([undefined, 4.75]);
});

test('the trip rules, as the website publishes them (or as the phone saved them)', () => {
  const rules = { hoursPerDay: 12, extraHour: 130, mealAllowance: 300, kmPerDay: 600, localWithinKm: 60 };
  expect(parseTripRules(rules)).toEqual(rules);
  expect(parseTripRules({ ...rules, stationHours: 1 })?.stationHours).toBe(1);
  expect(parseTripRules({ ...rules, averageKmh: 50 })?.averageKmh).toBe(50);
  expect(parseTripRules({ ...rules, extraFullDayAfterHours: 7 })?.extraFullDayAfter).toBe(7);
  expect(parseTripRules({ ...rules, extraFullDayAfter: 7 })?.extraFullDayAfter).toBe(7);
  expect(parseTripRules({ ...rules, extraFullDayAfterHours: 30 })?.extraFullDayAfter).toBeUndefined();
  // The rising day price comes as a pair, the top farther than the start.
  expect(parseTripRules({ ...rules, nearFromKm: 60, dayTopFromKm: 300 })).toMatchObject({
    nearFromKm: 60,
    dayTopFromKm: 300,
  });
  expect(parseTripRules({ ...rules, nearFromKm: 60 })?.nearFromKm).toBeUndefined();
  expect(parseTripRules({ ...rules, nearFromKm: 300, dayTopFromKm: 60 })?.nearFromKm).toBeUndefined();
  expect(parseTripRules({ ...rules, nearFromKm: 60.5, dayTopFromKm: 300 })?.nearFromKm).toBeUndefined();
  // An older file with the way-home and route-price keys: read, and those left out.
  const old = { ...rules, returnHour: 120, returnMaxPerDay: 1200, routeBase: 350, shortDriveMinimum: 600 };
  expect(parseTripRules(old)).toEqual(rules);
  // A required number missing or odd: the whole block is refused.
  expect(parseTripRules({ ...rules, extraHour: 0 })).toBeNull();
  expect(parseTripRules('x')).toBeNull();
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

test('driving: more than 7 hours left over after the full days count as one more day (website rule, 29 Oct 2026)', () => {
  const p = planTrip(config, 'one-way-drop', 'Raipur', 'mumbai'); // 22.4 h = 1 day + 11 h → 2 days
  expect([p.fullDays, p.extraHours]).toEqual([2, 0]);
  const n = planTrip(config, 'one-way-drop', 'Raipur', 'nagpur'); // 6 h: by the hour
  expect([n.fullDays, n.extraHours]).toEqual([0, 6]);
});

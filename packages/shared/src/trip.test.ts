import { DEFAULT_CONFIG } from './config';
import {
  ELSEWHERE,
  POPULAR_DESTINATIONS,
  isTripPackage,
  notesWithTrip,
  parseDestinations,
  parseTripRules,
  planTrip,
  dropTime,
  returnCost,
  searchDestinations,
  startHourOf,
  toQuote,
  toTrip,
  tripNote,
  tripRecord,
} from './trip';

const config = DEFAULT_CONFIG;

/* The worked examples agreed with the owner (website: scripts/outstation.test.mjs, 28 Oct 2026):
   each 12 h of driving is a day at ₹1,550–1,650, the rest ₹120 an hour (a shorter
   drive: all by the hour); the way home from the drop until he is home, waiting
   included, ₹120 an hour, at most ₹1,200 a day. Timings from the start. */

test('Raipur → Nagpur one-way: 6 h of driving + 6 h home, all by the hour — ₹1,440', () => {
  const p = planTrip(config, 'one-way-drop', 'Raipur', 'nagpur');
  expect([p.km, p.fullDays, p.extraHours, p.days, p.returnHours, p.local]).toEqual([284, 0, 6, 1, 6, false]);
  expect([p.est?.from, p.est?.to]).toEqual([1440, 1440]);
});

test('Raipur → Mumbai one-way: 1 day + 11 h, the 9:10 PM Mail, 23 h home — ₹4,070–4,170', () => {
  const p = planTrip(config, 'one-way-drop', 'Raipur', 'mumbai');
  expect([p.fullDays, p.extraHours, p.days, p.returnHours]).toEqual([1, 11, 2, 23]);
  expect(p.train?.no).toBe('12809');
  expect([p.est?.extraCharge, p.est?.returnCharge]).toEqual([1320, 1200]);
  expect([p.est?.from, p.est?.to]).toEqual([4070, 4170]);
});

test('Raipur → Hyderabad: the direct train only Mon, Wed & Fri; other days the Dakshin Exp via Nagpur', () => {
  const sunday = planTrip(config, 'one-way-drop', 'Raipur', 'hyderabad', 0, { hour: 9, weekday: 0 });
  expect(sunday.train?.no).toBe('12771');
  expect((sunday.leaveAt ?? 0) - (sunday.dropAt ?? 0)).toBeGreaterThan(9);
  expect(sunday.startHour).toBe(9);
  const monday = planTrip(config, 'one-way-drop', 'Raipur', 'hyderabad', 0, { hour: 9, weekday: 1 });
  expect([monday.train?.no, monday.train?.via]).toEqual(['12721', 'Nagpur']);
});

test('Raipur → Bengaluru, Thursday 7:30 AM day and night: the Friday Wainganga Exp, never the Thu/Sat-only 12975', () => {
  const p = planTrip(config, 'one-way-drop', 'Raipur', 'bengaluru', 0, { hour: 7.5, weekday: 4 }, true);
  expect(p.train?.no).toBe('12251');
});

test('Raipur → Delhi: the trains that do not run that day are skipped', () => {
  expect(planTrip(config, 'one-way-drop', 'Raipur', 'delhi').train?.no).toBe('18238');
  expect(planTrip(config, 'one-way-drop', 'Raipur', 'delhi', 0, { hour: 7, weekday: 0 }).train?.no).toBe(
    '12808',
  );
  expect(planTrip(config, 'one-way-drop', 'Raipur', 'delhi', 0, { hour: 7, weekday: 1 }).train?.no).toBe(
    '18238',
  );
  const four = planTrip(config, 'one-way-drop', 'Raipur', 'delhi', 4);
  expect([four.days, four.fullDays, four.extraHours]).toEqual([4, 4, 0]);
  expect(planTrip(config, 'one-way-drop', 'Raipur', 'delhi', 500).days).toBe(60);
});

test('Raipur → Bengaluru on a Monday: the daily change at Nagpur', () => {
  const p = planTrip(config, 'one-way-drop', 'Raipur', 'bengaluru', 0, { hour: 7, weekday: 1 });
  expect([p.fullDays, p.extraHours, p.days]).toEqual([2, 4, 3]);
  expect(p.train?.via).toBe('Nagpur');
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
      trains: undefined,
      from: Object.fromEntries(
        Object.entries(d.from).map(([c, l]) => [
          c,
          { ...l, oneWay: { days: l.oneWay.days, returnHours: l.oneWay.returnHours } },
        ]),
      ) as typeof d.from,
    })),
  };
  const p = planTrip(old, 'one-way-drop', 'Raipur', 'mumbai', 0, 22);
  expect([p.returnHours, p.dropAt, p.fullDays, p.extraHours]).toEqual([23, undefined, 1, 11]);
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
  expect([p.est?.from, p.est?.to]).toEqual([1550, 1650]);
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
  expect(planTrip(dearer, 'outstation', 'Raipur', 'nagpur').est?.from).toBe(1600);
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
  const line =
    'Trip: Raipur → Delhi · one-way drop · ~1214 km · 2 days + 38 h getting home · est. ₹5,620–5,820';
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

test('the published table is read with its trains and timings; odd ones are dropped, never the table', () => {
  const json = JSON.parse(JSON.stringify(config.destinations));
  const parsed = parseDestinations(json);
  expect(parsed).toEqual(config.destinations);
  const delhi = json.find((d: { id: string }) => d.id === 'delhi');
  delhi.trains[0].dep = '25:00';
  delhi.from.Raipur.oneWay.homeHours = -1;
  const again = parseDestinations(json);
  const d = again?.find((x) => x.id === 'delhi');
  expect(d?.trains).toBeUndefined();
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
});

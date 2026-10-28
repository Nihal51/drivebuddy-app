import { DEFAULT_CONFIG } from './config';
import {
  ELSEWHERE,
  POPULAR_DESTINATIONS,
  isTripPackage,
  notesWithTrip,
  parseDestinations,
  parseTripRules,
  planTrip,
  returnCost,
  returnDayCost,
  searchDestinations,
  startHourOf,
  toQuote,
  toTrip,
  tripNote,
  tripRecord,
} from './trip';

const config = DEFAULT_CONFIG;

/* The worked examples agreed with the owner (website: scripts/outstation.test.mjs):
   600 km a day; a driving day is a driving day and the trip home is its own
   day; the start time decides the train. ₹1,550–1,650 a day, ₹1,200 return
   day, ₹120 a late hour. */

test('Raipur → Nagpur one-way: home the same evening, so one day is all — ₹1,550–1,650', () => {
  const p = planTrip(config, 'one-way-drop', 'Raipur', 'nagpur');
  expect([p.km, p.days, p.returnHours, p.returnDay, p.local]).toEqual([284, 1, 0, false, false]);
  expect([p.est?.from, p.est?.to, p.est?.returnCharge]).toEqual([1550, 1650, 0]);
});

test('Raipur → Mumbai one-way: 2 driving days + 1 return day = ₹4,300–4,500', () => {
  const p = planTrip(config, 'one-way-drop', 'Raipur', 'mumbai');
  expect(p.days).toBe(2);
  expect(p.train?.no).toBe('12809');
  expect([p.returnDay, p.lateHours]).toEqual([true, 0]);
  expect([p.est?.returnDayCharge, p.est?.lateCharge]).toEqual([1200, 0]);
  expect([p.est?.from, p.est?.to]).toEqual([4300, 4500]);
});

test('Raipur → Delhi one-way: 2 days + the return day; extra days booked are charged', () => {
  const p = planTrip(config, 'one-way-drop', 'Raipur', 'delhi');
  expect([p.minDays, p.days, p.returnDay]).toEqual([2, 2, true]);
  expect([p.est?.from, p.est?.to]).toEqual([4300, 4500]);
  const longer = planTrip(config, 'one-way-drop', 'Raipur', 'delhi', 4);
  expect([longer.days, longer.returnHours, longer.est?.from]).toEqual([4, p.returnHours, 4 * 1550 + 1200]);
  expect(planTrip(config, 'one-way-drop', 'Raipur', 'delhi', 1).days).toBe(2);
  expect(planTrip(config, 'one-way-drop', 'Raipur', 'delhi', 500).days).toBe(60);
});

test('Raipur → Hyderabad at 9 AM: drops ~12:30 PM day 2, waits for the 10:40 PM train — a return day', () => {
  const p = planTrip(config, 'one-way-drop', 'Raipur', 'hyderabad', 0, 9);
  expect(p.train?.no).toBe('12771');
  expect((p.leaveAt ?? 0) - (p.dropAt ?? 0)).toBeGreaterThan(9);
  expect([p.returnDay, p.est?.from]).toEqual([true, 4300]);
  expect(p.startHour).toBe(9);
});

test('Raipur → Kolkata: the afternoon Gitanjali gets him home before day 2 ends', () => {
  const p = planTrip(config, 'one-way-drop', 'Raipur', 'kolkata');
  expect(p.train?.no).toBe('12860');
  expect([p.days, p.returnHours, p.est?.from]).toEqual([2, 0, 3100]);
});

test('the same answer as the website table for a 7 AM start, for every place and city', () => {
  for (const d of config.destinations)
    for (const city of ['Raipur', 'Bhilai', 'Durg', 'Bilaspur'] as const) {
      const p = planTrip(config, 'one-way-drop', city, d.id);
      if (p.sameCity) continue;
      expect([d.id, city, p.returnHours]).toEqual([d.id, city, d.from[city].oneWay.returnHours]);
    }
});

test('an older website file without the timings: its table figure, priced the new way', () => {
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
  expect([p.returnHours, p.dropAt, p.est?.from]).toEqual([
    config.destinations.find((d) => d.id === 'mumbai')?.from.Raipur.oneWay.returnHours,
    undefined,
    4300,
  ]);
});

test('the return day and late hours (the owner: home 6 hours after the return day ends)', () => {
  expect(returnDayCost(0, 120, 1200)).toBe(0);
  expect(returnDayCost(3, 120, 1200)).toBe(1200);
  expect(returnDayCost(30, 120, 1200)).toBe(1200 + 720);
  expect(returnDayCost(Number.NaN, 120, 1200)).toBe(0);
  expect(returnCost(4, 120, 1200)).toBe(480);
  expect(returnCost(14, 120, 1200)).toBe(1200);
});

test('the stored preferred time gives the start hour', () => {
  expect(startHourOf('2026-11-03T09:30')).toBe(9.5);
  expect(startHourOf('')).toBeUndefined();
  expect(startHourOf('soon')).toBeUndefined();
});

test('a round trip back home within the 24 hours is one day; longer ones drive both ways', () => {
  const p = planTrip(config, 'outstation', 'Raipur', 'nagpur');
  expect([p.kind, p.days, p.returnHours, p.returnDay]).toEqual(['round', 1, 0, false]);
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
  expect(planTrip(dearer, 'one-way-drop', 'Raipur', 'nagpur').est?.from).toBe(1600);
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
  const line = 'Trip: Raipur → Delhi · one-way drop · ~1214 km · 2 days + a return day · est. ₹4,300–4,500';
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
  expect(d?.from.Raipur.oneWay.lastDayHours).toBeUndefined();
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
});

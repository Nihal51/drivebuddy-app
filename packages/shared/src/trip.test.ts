import { DEFAULT_CONFIG } from './config';
import {
  ELSEWHERE,
  POPULAR_DESTINATIONS,
  isTripPackage,
  notesWithTrip,
  planTrip,
  returnCost,
  searchDestinations,
  toQuote,
  toTrip,
  tripNote,
  tripRecord,
} from './trip';

const config = DEFAULT_CONFIG;

/* The worked examples agreed with the owner (website: scripts/outstation.test.mjs). */

test('Raipur → Nagpur one-way: home the same evening, so one day is all — ₹1,450–1,650', () => {
  const p = planTrip(config, 'one-way-drop', 'Raipur', 'nagpur');
  expect([p.km, p.days, p.returnHours, p.local]).toEqual([284, 1, 0, false]);
  expect([p.est?.from, p.est?.to, p.est?.returnCharge]).toEqual([1450, 1650, 0]);
});

test('Raipur → Bhopal one-way: 2 days, home before they end', () => {
  const p = planTrip(config, 'one-way-drop', 'Raipur', 'bhopal');
  expect([p.days, p.returnHours]).toEqual([2, 0]);
});

test('Raipur → Delhi one-way: 3 days + 9 h still on the train (~22½ h by timetable)', () => {
  const p = planTrip(config, 'one-way-drop', 'Raipur', 'delhi');
  expect([p.minDays, p.days, p.returnHours]).toEqual([3, 3, 9]);
  expect(p.est?.returnCharge).toBe(1080);
  expect([p.est?.from, p.est?.to]).toEqual([5430, 6030]);
  // Extra days booked are charged; the return hours stay the same.
  const longer = planTrip(config, 'one-way-drop', 'Raipur', 'delhi', 5);
  expect([longer.days, longer.returnHours, longer.est?.from]).toEqual([5, 9, 5 * 1450 + 1080]);
  expect(planTrip(config, 'one-way-drop', 'Raipur', 'delhi', 1).days).toBe(3);
  expect(planTrip(config, 'one-way-drop', 'Raipur', 'delhi', 500).days).toBe(60);
});

test('Raipur → Mumbai one-way: ~18 h by train, 3 h after the last day, ₹360', () => {
  const p = planTrip(config, 'one-way-drop', 'Raipur', 'mumbai');
  expect([p.days, p.returnHours, p.est?.returnCharge]).toEqual([3, 3, 360]);
});

test("return hours: ₹120 each, at most ₹1,200 in any 24 hours (the owner's 6 AM → 10 AM example: ₹480)", () => {
  expect(returnCost(0, 120, 1200)).toBe(0);
  expect(returnCost(4, 120, 1200)).toBe(480);
  expect(returnCost(14, 120, 1200)).toBe(1200);
  expect(returnCost(30, 120, 1200)).toBe(1200 + 720);
});

test('a round trip back home within the 24 hours is one day; longer ones drive both ways', () => {
  const p = planTrip(config, 'outstation', 'Raipur', 'nagpur');
  expect([p.kind, p.days, p.returnHours]).toEqual(['round', 1, 0]);
  expect([p.est?.from, p.est?.to]).toEqual([1450, 1650]);
  expect(planTrip(config, 'outstation', 'Raipur', 'jharsuguda').days).toBe(1);
  expect(planTrip(config, 'outstation', 'Raipur', 'jabalpur').days).toBe(2);
  expect(planTrip(config, 'outstation', 'Raipur', 'delhi').days).toBe(6);
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
  const dearer = { ...config, prices: { ...config.prices, outstation: { from: 1500, to: 1700 } } };
  expect(planTrip(dearer, 'one-way-drop', 'Raipur', 'nagpur').est?.from).toBe(1500);
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
    'Trip: Raipur → Delhi · one-way drop · ~1214 km · 3 days + 9 h getting home · est. ₹5,430–6,030';
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

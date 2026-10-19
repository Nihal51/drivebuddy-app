import { DEFAULT_CONFIG } from './config';
import {
  ELSEWHERE,
  POPULAR_DESTINATIONS,
  isTripPackage,
  notesWithTrip,
  planTrip,
  searchDestinations,
  toQuote,
  toTrip,
  tripNote,
  tripRecord,
} from './trip';

const config = DEFAULT_CONFIG;

/* The worked examples agreed with the owner (website: scripts/outstation.test.mjs). */

test('Raipur → Nagpur one-way: 1 driving day + 1 return day, ₹2,450–2,850', () => {
  const p = planTrip(config, 'one-way-drop', 'Raipur', 'nagpur');
  expect([p.km, p.days, p.returnDays, p.local]).toEqual([284, 1, 1, false]);
  // ₹1,450–1,650 driving + ₹1,000–1,200 for the day on the bus/train home.
  expect([p.est?.from, p.est?.to]).toEqual([2450, 2850]);
  expect(p.est?.returnCharge).toEqual({ from: 1000, to: 1200 });
});

test('Raipur → Bilaspur one-way: home the same day', () => {
  const p = planTrip(config, 'one-way-drop', 'Raipur', 'bilaspur');
  expect([p.days, p.returnDays]).toEqual([1, 0]);
});

test('Raipur → Delhi one-way: 3 driving days + 2 return days; more days booked are charged', () => {
  const p = planTrip(config, 'one-way-drop', 'Raipur', 'delhi');
  expect([p.minDays, p.days, p.returnDays]).toEqual([3, 3, 2]);
  expect([p.est?.from, p.est?.to]).toEqual([3 * 1450 + 2 * 1000, 3 * 1650 + 2 * 1200]);
  const longer = planTrip(config, 'one-way-drop', 'Raipur', 'delhi', 5);
  expect(longer.days).toBe(5);
  expect(planTrip(config, 'one-way-drop', 'Raipur', 'delhi', 1).days).toBe(3);
  expect(planTrip(config, 'one-way-drop', 'Raipur', 'delhi', 500).days).toBe(60);
});

test('a round trip drives both ways and has no return days', () => {
  const p = planTrip(config, 'outstation', 'Raipur', 'nagpur');
  expect([p.kind, p.days, p.returnDays]).toEqual(['round', 2, 0]);
  expect([p.est?.from, p.est?.to]).toEqual([2900, 3300]);
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
  expect(planTrip(dearer, 'one-way-drop', 'Raipur', 'nagpur').est?.from).toBe(2500);
});

test('the saved trip', () => {
  const t = tripRecord(planTrip(config, 'one-way-drop', 'Raipur', ELSEWHERE), '  Jaipur   city ');
  expect(t).toEqual({
    to: 'Jaipur city',
    destId: '',
    kind: 'one-way',
    km: 0,
    days: 1,
    returnDays: 0,
    estFrom: 0,
    estTo: 0,
  });
  expect(toTrip(t)).toEqual(t);
});

test('read back defensively', () => {
  expect(toTrip(null)).toBeUndefined();
  expect(toTrip({ to: '' })).toBeUndefined();
  expect(toTrip({ to: 'Nagpur', km: 1.5, days: 1, returnDays: 0, estFrom: 0, estTo: 0 })).toBeUndefined();
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
  const t = tripRecord(planTrip(config, 'one-way-drop', 'Raipur', 'nagpur'), '');
  const line =
    'Trip: Raipur → Nagpur · one-way drop · ~284 km · 1 driving day + 1 return day · est. ₹2,450–2,850';
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

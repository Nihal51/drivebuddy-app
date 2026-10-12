import { BOOKING_STATUSES, CITIES, PACKAGE_GROUPS, PACKAGE_IDS, isCity, isPackageId } from './catalog';

/*
 * These lists must match the website's firestore.rules exactly (Nihal51/very_new).
 * If this test fails because the website changed, update catalog.ts to match —
 * never the other way round from here.
 */
test('package ids match firestore.rules', () => {
  expect([...PACKAGE_IDS].sort()).toEqual(
    [
      '1-hour-300',
      '3-hours-600',
      'local-full-day',
      'outstation',
      'night-driver',
      'medical-emergency',
      'monthly-basic',
      'monthly-premium',
      'wedding-event',
      'one-way-drop',
    ].sort(),
  );
});

test('served cities and statuses match firestore.rules', () => {
  expect(CITIES).toEqual(['Raipur', 'Bhilai', 'Durg', 'Bilaspur']);
  expect(BOOKING_STATUSES).toEqual(['new', 'confirmed', 'assigned', 'completed', 'cancelled']);
});

test('every package appears in exactly one group of the service list', () => {
  const grouped = PACKAGE_GROUPS.flatMap((g) => g.packages);
  expect(grouped.sort()).toEqual([...PACKAGE_IDS].sort());
});

test('type guards', () => {
  expect(isPackageId('outstation')).toBe(true);
  expect(isPackageId('outstation ')).toBe(false);
  expect(isPackageId(undefined)).toBe(false);
  expect(isCity('Durg')).toBe(true);
  expect(isCity('durg')).toBe(false);
});

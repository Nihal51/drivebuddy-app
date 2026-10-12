import {
  clock12,
  dayOptions,
  istDateKey,
  istParts,
  preferredTimeValue,
  timeSlots,
  tripInstant,
} from './time';

// 8 Oct 2026, 15:20 in India = 09:50 UTC
const NOW = Date.UTC(2026, 9, 8, 9, 50);

test('India time regardless of the phone time zone', () => {
  expect(istParts(NOW)).toEqual({ year: 2026, month: 10, day: 8, weekday: 4, hour: 15, minute: 20 });
  // 23:00 UTC on the 8th is already the 9th in India
  expect(istDateKey(Date.UTC(2026, 9, 8, 23, 0))).toBe('2026-10-09');
});

test('stored preferred time round-trips to the same instant as the website', () => {
  const value = preferredTimeValue('2026-10-08', '15:30');
  expect(value).toBe('2026-10-08T15:30');
  expect(tripInstant(value)?.toISOString()).toBe('2026-10-08T10:00:00.000Z');
  expect(tripInstant('')).toBeUndefined();
});

test('a week of days starting today', () => {
  const days = dayOptions(NOW);
  expect(days).toHaveLength(7);
  expect(days[0]?.key).toBe('2026-10-08');
  expect(days[6]?.key).toBe('2026-10-14');
});

test("today's slots start at least 45 minutes ahead; later days start at 05:00", () => {
  const today = timeSlots('2026-10-08', NOW);
  expect(today[0]).toBe('16:30'); // 15:20 + 45 min = 16:05 → next half hour
  expect(today.at(-1)).toBe('23:30');
  const tomorrow = timeSlots('2026-10-09', NOW);
  expect(tomorrow[0]).toBe('05:00');
  expect(tomorrow).toHaveLength(38);
});

test('12-hour clock', () => {
  expect(clock12(0, 30)).toEqual({ text: '12:30', pm: false });
  expect(clock12(15, 0)).toEqual({ text: '3:00', pm: true });
});

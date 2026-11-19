import { liveMapHtml } from '@/booking/DriverMap';

import { minutesAgo, readSpot } from './tracking';

describe('the driver on the map', () => {
  const at = new Date('2026-11-20T04:00:00Z');

  test('a tracking document → a spot in India, or nothing', () => {
    expect(readSpot({ lat: 21.25, lng: 81.63, active: true, at })).toEqual({
      lat: 21.25,
      lng: 81.63,
      active: true,
      at,
    });
    expect(readSpot({ lat: 21.25, lng: 81.63, active: false, at: { toDate: () => at } })?.active).toBe(false);
    expect(readSpot({ lat: 51.5, lng: -0.1, active: true, at })).toBeNull();
    expect(readSpot({ lat: 21.25, lng: 81.63, active: true })).toBeNull();
    expect(readSpot(undefined)).toBeNull();
  });

  test('minutes since the last update', () => {
    const spot = { lat: 21.25, lng: 81.63, active: true, at };
    expect(minutesAgo(spot, at.getTime() + 30_000)).toBe(0);
    expect(minutesAgo(spot, at.getTime() + 7 * 60_000)).toBe(7);
    expect(minutesAgo(spot, at.getTime() - 60_000)).toBe(0);
  });

  test('the map page starts on the driver', () => {
    expect(liveMapHtml(21.25, 81.63)).toContain('setView([21.25, 81.63], 15)');
  });
});

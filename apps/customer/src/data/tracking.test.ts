import { liveMapHtml } from '@/booking/DriverMap';

import { minutesAgo, readSpot, spotOfDriver } from './tracking';

describe('the driver on the map', () => {
  const at = new Date('2026-11-20T04:00:00Z');

  test('a tracking document → a spot in India, or nothing', () => {
    expect(readSpot({ lat: 21.25, lng: 81.63, active: true, at })).toEqual({
      lat: 21.25,
      lng: 81.63,
      active: true,
      at,
      driverId: '',
    });
    expect(readSpot({ lat: 21.25, lng: 81.63, active: false, at: { toDate: () => at } })?.active).toBe(false);
    expect(readSpot({ lat: 51.5, lng: -0.1, active: true, at })).toBeNull();
    expect(readSpot({ lat: 21.25, lng: 81.63, active: true })).toBeNull();
    expect(readSpot(undefined)).toBeNull();
  });

  test('who sent it, by driver id — an older point’s number is never read', () => {
    const spot = readSpot({
      lat: 21.25,
      lng: 81.63,
      active: true,
      at,
      driverId: 'd1',
      driverPhone: '9893302783',
    });
    expect(spot?.driverId).toBe('d1');
    expect(JSON.stringify(spot)).not.toContain('9893302783');
  });

  test('only the driver on the booking now: not the last point of one it was taken from', () => {
    const his = readSpot({ lat: 21.25, lng: 81.63, active: false, at, driverId: 'd1' });
    expect(spotOfDriver(his, 'd1')).toBe(his);
    expect(spotOfDriver(his, 'd2')).toBeNull();
    expect(spotOfDriver(his, undefined)).toBe(his);
    const old = readSpot({ lat: 21.25, lng: 81.63, active: true, at, driverPhone: '9893302783' });
    expect(spotOfDriver(old, 'd2')).toBe(old); // an older app's point: not known, so it counts
    expect(spotOfDriver(null, 'd1')).toBeNull();
  });

  test('minutes since the last update', () => {
    const spot = { lat: 21.25, lng: 81.63, active: true, at, driverId: '' };
    expect(minutesAgo(spot, at.getTime() + 30_000)).toBe(0);
    expect(minutesAgo(spot, at.getTime() + 7 * 60_000)).toBe(7);
    expect(minutesAgo(spot, at.getTime() - 60_000)).toBe(0);
  });

  test('the map page starts on the driver', () => {
    expect(liveMapHtml(21.25, 81.63)).toContain('setView([21.25, 81.63], 15)');
  });
});

/**
 * The contract with the website (Nihal51/very_new), checked against what is
 * LIVE — the published app-config.json and the firestore.rules on GitHub.
 *
 * Needs the internet, so it runs only with CONTRACT=1: in CI on every push and
 * once a day (.github/workflows/ci.yml, job "contract"). If the website
 * changes a price format, a package, a city or a field the rules accept, this
 * goes red before customers see a broken app.
 *
 *     CONTRACT=1 npx jest contract      (from packages/shared)
 */

import { BOOKING_CREATE_KEYS, newBookingFields } from './booking';
import { CITIES, PACKAGE_IDS } from './catalog';
import { parseAppConfig } from './config';
import { DEVICE_KEYS, isExpoPushToken } from './account';

// Overridable to check a local copy before pushing (CONTRACT_SITE / CONTRACT_RULES).
const SITE = process.env.CONTRACT_SITE ?? 'https://thedrivebuddy.in';
const RULES =
  process.env.CONTRACT_RULES ?? 'https://raw.githubusercontent.com/Nihal51/very_new/main/firestore.rules';

const live = process.env.CONTRACT === '1' ? describe : describe.skip;

async function text(url: string): Promise<string> {
  const res = await fetch(`${url}?t=${Date.now()}`, { headers: { 'Cache-Control': 'no-cache' } });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res.text();
}

/** The quoted strings inside the first `[...]` after `marker`. */
function listAfter(source: string, marker: string): string[] {
  const at = source.indexOf(marker);
  if (at < 0) throw new Error(`"${marker}" not found in firestore.rules`);
  const open = source.indexOf('[', at);
  const close = source.indexOf(']', open);
  return [...source.slice(open, close).matchAll(/'([^']+)'/g)].map((m) => m[1] as string);
}

live('contract with the live website', () => {
  jest.setTimeout(30_000);

  test('the published app-config.json passes every check the app makes', async () => {
    const parsed = parseAppConfig(JSON.parse(await text(`${SITE}/app-config.json`)));
    expect(parsed).not.toBeNull();
  });

  describe('firestore.rules on GitHub', () => {
    let rules = '';
    beforeAll(async () => {
      rules = await text(RULES);
    });

    test('accepts exactly the app’s packages and cities', () => {
      expect(listAfter(rules, 'request.resource.data.package in').sort()).toEqual([...PACKAGE_IDS].sort());
      expect(listAfter(rules, 'function isServedCity').sort()).toEqual([...CITIES].sort());
    });

    test('accepts the fields of an app booking, with source "app"', () => {
      const bookings = rules.slice(rules.indexOf('match /bookings/{bookingId}'));
      expect(listAfter(bookings, 'keys().hasOnly(').sort()).toEqual([...BOOKING_CREATE_KEYS].sort());
      expect(listAfter(rules, 'data.source in')).toContain('app');
      const fields = newBookingFields(
        {
          name: 'Contract Test',
          phone: '9876543210',
          city: 'Raipur',
          packageId: '1-hour-300',
          pickup: 'Contract test address',
          preferredTime: '',
          notes: '',
        },
        'uid',
      );
      for (const key of Object.keys(fields)) expect(BOOKING_CREATE_KEYS).toContain(key);
    });

    test('lets the app register phones for notifications in the shape it writes', () => {
      const devices = rules.slice(rules.indexOf('match /devices/{deviceId}'));
      expect(listAfter(devices, 'keys().hasOnly(').sort()).toEqual([...DEVICE_KEYS].sort());
      expect(isExpoPushToken('ExponentPushToken[abcdEFGH1234]')).toBe(true);
    });

    test('lets a customer delete their own profile (Delete my account)', () => {
      const users = rules.slice(
        rules.indexOf('match /users/{uid}'),
        rules.indexOf('match /devices/{deviceId}'),
      );
      expect(users).toMatch(/allow delete: if isOwner\(\);/);
    });
  });
});

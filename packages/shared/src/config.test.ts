import { DEFAULT_CONFIG, compareVersions, mustUpdate, parseAppConfig } from './config';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

// A downloaded file with the trip blocks means the website takes trips.
const LIVE = { ...DEFAULT_CONFIG, tripsLive: true };

test('the built-in config passes its own checks', () => {
  expect(parseAppConfig(clone(DEFAULT_CONFIG))).toEqual(LIVE);
});

test('extra fields from a newer website are dropped, not kept', () => {
  const raw = { ...clone(DEFAULT_CONFIG), future: 1, contact: { ...DEFAULT_CONFIG.contact, fax: 'x' } };
  const parsed = parseAppConfig(raw);
  expect(parsed).toEqual(LIVE);
  expect(parsed).not.toHaveProperty('future');
});

test.each([
  ['not an object', 'hello'],
  ['wrong schema', { ...DEFAULT_CONFIG, schema: 2 }],
  ['price as text', { ...DEFAULT_CONFIG, prices: { ...DEFAULT_CONFIG.prices, oneHour: '300' } }],
  ['zero price', { ...DEFAULT_CONFIG, prices: { ...DEFAULT_CONFIG.prices, threeHours: 0 } }],
  [
    'range upside down',
    { ...DEFAULT_CONFIG, prices: { ...DEFAULT_CONFIG.prices, fullDay: { from: 1200, to: 1000 } } },
  ],
  ['bad phone', { ...DEFAULT_CONFIG, contact: { ...DEFAULT_CONFIG.contact, phone: '12345' } }],
  ['http link', { ...DEFAULT_CONFIG, site: { ...DEFAULT_CONFIG.site, privacy: 'http://x.in/privacy' } }],
  ['missing block', { ...DEFAULT_CONFIG, monthly: undefined }],
])('rejects a file with %s', (_why, raw) => {
  expect(parseAppConfig(clone(raw))).toBeNull();
});

test('an older website file without the app block is still accepted, enforcing nothing', () => {
  const { app: _app, ...old } = clone(DEFAULT_CONFIG);
  expect(parseAppConfig(old)?.app.minVersion).toBe('0.0.0');
});

test('an older website file without trip estimates still works, with the built-in table', () => {
  const { outstation: _o, destinations: _d, ...old } = clone(DEFAULT_CONFIG);
  // That website's outstation price was per trip; the built-in per-day range is used instead.
  old.prices.outstation = { from: 1200, to: 1500 };
  const parsed = parseAppConfig(old);
  expect(parsed?.outstation.returnHour).toBe(DEFAULT_CONFIG.outstation.returnHour);
  expect(parsed?.destinations.length).toBe(DEFAULT_CONFIG.destinations.length);
  expect(parsed?.prices.outstation).toEqual(DEFAULT_CONFIG.prices.outstation);
  expect(parsed?.tripsLive).toBe(false);
});

test('the nearby day prices: read when published, none from a website file from before them', () => {
  const raw = clone(DEFAULT_CONFIG);
  expect(parseAppConfig(raw)?.prices.outstationNear).toEqual(DEFAULT_CONFIG.prices.outstationNear);
  const { outstationNear: _n, ...oldPrices } = clone(DEFAULT_CONFIG.prices);
  // That website charged one day price everywhere.
  expect(parseAppConfig({ ...raw, prices: oldPrices })?.prices.outstationNear).toEqual([]);
  const withNear = (outstationNear: unknown) =>
    parseAppConfig({ ...raw, prices: { ...raw.prices, outstationNear } });
  expect(withNear([])?.prices.outstationNear).toEqual([]);
  expect(
    withNear([
      { upToKm: 300, from: 1450, to: 1550 },
      { upToKm: 150, from: 1300, to: 1400 },
    ]),
  ).toBeNull();
  expect(withNear([{ upToKm: 150, from: 1400, to: 1300 }])).toBeNull();
  expect(withNear([{ upToKm: 0, from: 1300, to: 1400 }])).toBeNull();
  expect(withNear('cheap')).toBeNull();
});

test('a broken trip block or destination row rejects the file', () => {
  const raw = clone(DEFAULT_CONFIG) as unknown as Record<string, unknown>;
  const bad = (patch: Record<string, unknown>) => parseAppConfig({ ...raw, ...patch });
  expect(bad({ outstation: { ...DEFAULT_CONFIG.outstation, returnHour: 0 } })).toBeNull();
  expect(bad({ outstation: { ...DEFAULT_CONFIG.outstation, returnMaxPerDay: '1200' } })).toBeNull();
  expect(bad({ destinations: [] })).toBeNull();
  const rows = clone(DEFAULT_CONFIG.destinations);
  delete (rows[3] as { from: Record<string, unknown> }).from.Durg;
  expect(bad({ destinations: rows })).toBeNull();
  expect(bad({ destinations: [{ ...clone(DEFAULT_CONFIG.destinations[0]), id: 'Bad Id' }] })).toBeNull();
  // Only one of the two blocks: also rejected (they come together).
  expect(bad({ destinations: undefined })).toBeNull();
});

test('the minimum app version must look like 1.2.3 and store links must be the real stores', () => {
  const bad = (app: object) =>
    parseAppConfig({ ...clone(DEFAULT_CONFIG), app: { ...DEFAULT_CONFIG.app, ...app } });
  expect(bad({ minVersion: '2' })).toBeNull();
  expect(bad({ playStoreUrl: 'https://evil.example/app' })).toBeNull();
  expect(bad({ appStoreUrl: 'https://apps.apple.com/in/app/drivebuddy/id123' })).not.toBeNull();
});

test('versions compare number by number', () => {
  expect(compareVersions('1.10.0', '1.9.3')).toBe(1);
  expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
  expect(compareVersions('0.9.9', '1.0.0')).toBe(-1);
  const min = (v: string) => ({ ...DEFAULT_CONFIG, app: { ...DEFAULT_CONFIG.app, minVersion: v } });
  expect(mustUpdate('1.0.0', min('1.1.0'))).toBe(true);
  expect(mustUpdate('1.1.0', min('1.1.0'))).toBe(false);
  expect(mustUpdate(null, min('9.9.9'))).toBe(false); // web preview, unknown: never blocks
});

import { DEFAULT_CONFIG, compareVersions, mustUpdate, parseAppConfig } from './config';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

test('the built-in config passes its own checks', () => {
  expect(parseAppConfig(clone(DEFAULT_CONFIG))).toEqual(DEFAULT_CONFIG);
});

test('extra fields from a newer website are dropped, not kept', () => {
  const raw = { ...clone(DEFAULT_CONFIG), future: 1, contact: { ...DEFAULT_CONFIG.contact, fax: 'x' } };
  const parsed = parseAppConfig(raw);
  expect(parsed).toEqual(DEFAULT_CONFIG);
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

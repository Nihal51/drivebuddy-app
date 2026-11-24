import {
  DEFAULT_CASH_LIMIT,
  DEFAULT_CONFIG,
  compareVersions,
  mustUpdate,
  parseAppConfig,
  parseCashLimit,
} from './config';

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
  expect(parsed?.outstation.extraHour).toBe(DEFAULT_CONFIG.outstation.extraHour);
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
  expect(bad({ outstation: { ...DEFAULT_CONFIG.outstation, extraHour: 0 } })).toBeNull();
  expect(bad({ outstation: { ...DEFAULT_CONFIG.outstation, mealAllowance: '300' } })).toBeNull();
  expect(bad({ destinations: [] })).toBeNull();
  const rows = clone(DEFAULT_CONFIG.destinations);
  delete (rows[3] as { from: Record<string, unknown> }).from.Durg;
  expect(bad({ destinations: rows })).toBeNull();
  expect(bad({ destinations: [{ ...clone(DEFAULT_CONFIG.destinations[0]), id: 'Bad Id' }] })).toBeNull();
  // Only one of the two blocks: also rejected (they come together).
  expect(bad({ destinations: undefined })).toBeNull();
});

test('the website file of 8 Nov 2026 (the driver’s time) and the one before it are both read', () => {
  const raw = clone(DEFAULT_CONFIG);
  // As published from 8 Nov 2026: the rising day price, the old way-home keys still alongside.
  const now = {
    ...raw,
    outstation: {
      ...raw.outstation,
      extraFullDayAfter: undefined,
      extraFullDayAfterHours: 7,
      returnHour: 120,
      returnMaxPerDay: 1200,
      returnFullDayAfterHours: 6,
      sameDayMaxHours: 14,
    },
  };
  expect(parseAppConfig(now)?.outstation).toEqual(DEFAULT_CONFIG.outstation);
  // The file from before (route price, short drives, two nearby tiers, no rising price): still accepted.
  const before = {
    ...raw,
    prices: {
      ...raw.prices,
      outstation: { from: 1550, to: 1650 },
      outstationNear: [
        { upToKm: 150, from: 1300, to: 1400 },
        { upToKm: 300, from: 1450, to: 1550 },
      ],
    },
    outstation: {
      hoursPerDay: 12,
      extraHour: 120,
      returnHour: 120,
      returnMaxPerDay: 1200,
      shortDriveMinimum: 600,
      shortDriveHours: 3,
      routeAfterHours: 12,
      routeBase: 350,
      routePerKm: 4.5,
      routeMinBase: 0,
      routeMinPerDay: 1650,
      routeMaxPerDay: 1850,
      mealAllowance: 300,
      kmPerDay: 600,
      localWithinKm: 60,
      stationHours: 1,
      averageKmh: 50,
    },
  };
  const old = parseAppConfig(before);
  expect(old?.outstation).not.toHaveProperty('nearFromKm');
  expect(old?.outstation).not.toHaveProperty('routeBase');
  expect(old?.prices.outstationNear).toHaveLength(2);
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

describe('cash limit', () => {
  test('read from payments.cashLimit in whole rupees', () => {
    expect(parseCashLimit({ ...clone(DEFAULT_CONFIG), payments: { cashLimit: 2500 } })).toBe(2500);
    expect(parseCashLimit({ payments: { cashLimit: 0 } })).toBe(0);
  });

  test('absent or odd → null (the app then keeps its saved or built-in limit)', () => {
    expect(parseCashLimit(clone(DEFAULT_CONFIG))).toBeNull();
    for (const odd of ['2000', 1999.5, -1, 2_000_000, null])
      expect(parseCashLimit({ payments: { cashLimit: odd } })).toBeNull();
    expect(parseCashLimit({ payments: 2000 })).toBeNull();
    expect(parseCashLimit('hello')).toBeNull();
    expect(DEFAULT_CASH_LIMIT).toBe(2000);
  });

  test('a payments block never changes whether the prices are accepted', () => {
    expect(parseAppConfig({ ...clone(DEFAULT_CONFIG), payments: { cashLimit: 'odd' } })).toEqual(LIVE);
  });
});

describe('12 hours and the extra-hour rate', () => {
  test('twelveHours is read when the website lists it, left out when it does not', () => {
    const raw = { ...clone(DEFAULT_CONFIG), prices: { ...DEFAULT_CONFIG.prices, twelveHours: 1400 } };
    expect(parseAppConfig(raw)?.prices.twelveHours).toBe(1400);
    expect(parseAppConfig(clone(DEFAULT_CONFIG))?.prices).not.toHaveProperty('twelveHours');
    expect(DEFAULT_CONFIG.prices.twelveHours).toBeUndefined(); // offered only once the website has it
  });

  test('localExtraHour is read; an older file without it keeps the built-in rate', () => {
    const raw = { ...clone(DEFAULT_CONFIG), prices: { ...DEFAULT_CONFIG.prices, localExtraHour: 175 } };
    expect(parseAppConfig(raw)?.prices.localExtraHour).toBe(175);
    const old = clone(DEFAULT_CONFIG) as unknown as { prices: Record<string, unknown> };
    delete old.prices.localExtraHour;
    expect(parseAppConfig(old)?.prices.localExtraHour).toBe(120);
  });

  test('an odd value refuses the file, like any other price', () => {
    for (const odd of [{ twelveHours: '1400' }, { twelveHours: 0 }, { localExtraHour: -1 }])
      expect(
        parseAppConfig({ ...clone(DEFAULT_CONFIG), prices: { ...DEFAULT_CONFIG.prices, ...odd } }),
      ).toBeNull();
  });
});

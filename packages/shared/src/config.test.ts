import { DEFAULT_CONFIG, parseAppConfig } from './config';

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

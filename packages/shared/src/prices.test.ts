import { PACKAGE_IDS } from './catalog';
import { DEFAULT_CONFIG } from './config';
import {
  indianDigits,
  joiningFees,
  packageOffered,
  packagePrice,
  rupeeRange,
  rupees,
  startingFrom,
} from './prices';

test('Indian digit grouping, like the website', () => {
  expect(indianDigits(300)).toBe('300');
  expect(indianDigits(1000)).toBe('1,000');
  expect(indianDigits(16000)).toBe('16,000');
  expect(indianDigits(100000)).toBe('1,00,000');
  expect(indianDigits(12345678)).toBe('1,23,45,678');
  expect(rupees(20000)).toBe('₹20,000');
});

test('ranges use an en dash and collapse when both ends match', () => {
  expect(rupeeRange({ from: 1000, to: 1200 })).toBe('₹1,000–1,200');
  expect(rupeeRange({ from: 900, to: 900 })).toBe('₹900');
});

test('every package has a price shape', () => {
  for (const id of PACKAGE_IDS) expect(packagePrice(DEFAULT_CONFIG, id).kind).toBeTruthy();
  expect(packagePrice(DEFAULT_CONFIG, '1-hour-300')).toEqual({ kind: 'fixed', amount: '₹300' });
  expect(packagePrice(DEFAULT_CONFIG, 'night-driver')).toEqual({ kind: 'from', amount: '₹500' });
  expect(packagePrice(DEFAULT_CONFIG, 'monthly-basic')).toEqual({
    kind: 'monthly',
    amount: '₹16,000–17,000',
  });
  expect(packagePrice(DEFAULT_CONFIG, 'wedding-event')).toEqual({ kind: 'quote' });
  // Outstation: the day price over every distance (₹1,050 close by … ₹1,750 at 300 km and farther).
  expect(packagePrice(DEFAULT_CONFIG, 'outstation')).toEqual({ kind: 'perDay', amount: '₹1,050–1,750' });
  // One-way drops: priced by the driver's time — never "a day".
  expect(packagePrice(DEFAULT_CONFIG, 'one-way-drop')).toEqual({ kind: 'byDistance' });
});

test('prices follow the downloaded config, not the package id', () => {
  const config = { ...DEFAULT_CONFIG, prices: { ...DEFAULT_CONFIG.prices, oneHour: 350 } };
  expect(packagePrice(config, '1-hour-300')).toEqual({ kind: 'fixed', amount: '₹350' });
  expect(startingFrom(config)).toBe('₹350');
});

test('joining fees', () => {
  expect(joiningFees(DEFAULT_CONFIG)).toEqual({ basic: '₹4,000–4,250', premium: '₹2,000' });
});

describe('12 hours in the city', () => {
  const withTwelve = { ...DEFAULT_CONFIG, prices: { ...DEFAULT_CONFIG.prices, twelveHours: 1400 } };

  test('a fixed price once the website lists it; offered only then', () => {
    expect(packagePrice(withTwelve, 'local-12-hours')).toEqual({ kind: 'fixed', amount: '₹1,400' });
    expect(packageOffered(withTwelve, 'local-12-hours')).toBe(true);
    expect(packageOffered(DEFAULT_CONFIG, 'local-12-hours')).toBe(false);
    expect(packagePrice(DEFAULT_CONFIG, 'local-12-hours')).toEqual({ kind: 'quote' });
    expect(packageOffered(DEFAULT_CONFIG, '3-hours-600')).toBe(true);
  });
});

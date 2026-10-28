import { DEFAULT_CONFIG, PACKAGE_IDS, packagePrice } from '@drivebuddy/shared';

import { type Messages, en } from './en';
import {
  billBreakdown,
  clockText,
  errorText,
  formatDateTime,
  formatPreferred,
  formatSlot,
  priceLabel,
} from './format';
import { hi } from './hi';

/** Every leaf of a message set: strings, and functions called with sample arguments. */
function leaves(node: unknown, path = ''): [string, string][] {
  if (typeof node === 'string') return [[path, node]];
  if (typeof node === 'function') {
    const out = (node as (...a: unknown[]) => unknown)(15, 'X', 3, 'Y');
    return [[`${path}()`, String(out)]];
  }
  if (Array.isArray(node)) return node.flatMap((v, i) => leaves(v, `${path}[${i}]`));
  if (node && typeof node === 'object')
    return Object.entries(node).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
  return [];
}

describe.each([
  ['English', en],
  ['Hindi', hi],
] as [string, Messages][])('%s', (_name, t) => {
  test('no empty text anywhere', () => {
    const empty = leaves(t).filter(([, v]) => !v.trim());
    expect(empty).toEqual([]);
  });

  test('every package has a name and a price label', () => {
    for (const id of PACKAGE_IDS) {
      expect(t.packages[id].name).toBeTruthy();
      expect(priceLabel(t, packagePrice(DEFAULT_CONFIG, id))).toBeTruthy();
    }
  });

  test('every error code the forms produce has a sentence', () => {
    expect(errorText(t, 'name', 'required')).not.toBe(t.errors.generic);
    expect(errorText(t, 'phone', 'invalidMobile')).not.toBe(t.errors.generic);
    expect(errorText(t, 'pickup', 'tooShort')).not.toBe(t.errors.generic);
    expect(errorText(t, 'city', 'tooLong')).toBe(t.errors.generic); // not a real combination → generic
  });
});

test('Hindi has exactly the same lines as English', () => {
  const keys = (m: Messages) => leaves(m).map(([k]) => k);
  expect(keys(hi)).toEqual(keys(en));
});

test('dates and times read naturally in both languages (India time)', () => {
  const at = Date.UTC(2026, 9, 8, 10, 0); // 3:30 pm in India
  expect(formatDateTime(en, at)).toBe('Thu, 8 Oct, 3:30 pm');
  expect(formatDateTime(hi, at)).toBe('गुरु, 8 अक्टू॰, दोपहर 3:30');
  expect(formatPreferred(en, '')).toBe('As soon as possible');
  expect(formatPreferred(en, '2026-10-09T21:00')).toBe('Fri, 9 Oct, 9:00 pm');
  expect(formatSlot(hi, '06:30')).toBe('सुबह 6:30');
  expect(formatSlot(hi, '21:00')).toBe('रात 9:00');
});

test('prices in words', () => {
  expect(priceLabel(en, { kind: 'from', amount: '₹500' })).toBe('from ₹500');
  expect(priceLabel(hi, { kind: 'from', amount: '₹500' })).toBe('₹500 से');
  expect(priceLabel(en, { kind: 'monthly', amount: '₹20,000' })).toBe('₹20,000/month');
});

test('the final bill and the trip times, in both languages', () => {
  const bill = {
    amount: 6200,
    dayRate: 1600,
    days: 2,
    extraHours: 5,
    extraHourRate: 120,
    extraCharge: 600,
    returnHours: 38,
    returnHourRate: 120,
    returnCharge: 2400,
    ticket: 0,
    nonstop: true,
  };
  expect(billBreakdown(en, bill)).toBe('₹1,600 × 2 days + ₹600 for 5 extra hours + ₹2,400 way home (38 h)');
  expect(billBreakdown(hi, bill)).toContain('₹600 5 घंटे अतिरिक्त ड्राइविंग');
  const clock = {
    startAt: new Date('2026-10-29T02:15:00Z'),
    dropAt: new Date('2026-10-30T07:10:00Z'),
    homeAt: new Date('2026-10-31T20:50:00Z'),
  };
  expect(clockText(en, clock, 'one-way')).toBe(
    'Driver left Thu, 29 Oct, 7:45 am · car dropped Fri, 30 Oct, 12:40 pm · driver home Sun, 1 Nov, 2:20 am',
  );
  expect(clockText(en, { startAt: clock.startAt, homeAt: clock.homeAt }, 'round')).toBe(
    'Driver left Thu, 29 Oct, 7:45 am · back Sun, 1 Nov, 2:20 am',
  );
  expect(clockText(hi, clock, 'one-way')).toMatch(/^ड्राइवर निकले .* · गाड़ी छोड़ी .* · ड्राइवर घर पहुँचे /);
});

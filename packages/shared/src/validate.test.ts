import {
  normalisePhone,
  validateName,
  validateNotes,
  validateOptionalPhone,
  validatePhone,
  validatePickup,
} from './validate';

test('phone numbers are cleaned the way customers type them', () => {
  expect(normalisePhone('+91 91114 73929')).toBe('9111473929');
  expect(normalisePhone('09111473929')).toBe('9111473929');
  expect(normalisePhone('91114-73929')).toBe('9111473929');
});

test('mobile numbers: 10 digits starting 6–9', () => {
  expect(validatePhone('')).toBe('required');
  expect(validatePhone('5111473929')).toBe('invalidMobile');
  expect(validatePhone('911147392')).toBe('invalidMobile');
  expect(validatePhone('+91 91114 73929')).toBeUndefined();
  expect(validateOptionalPhone('')).toBeUndefined();
  expect(validateOptionalPhone('123')).toBe('invalidMobile');
});

test('names: 2–60 characters', () => {
  expect(validateName('  ')).toBe('required');
  expect(validateName('A')).toBe('tooShort');
  expect(validateName('A'.repeat(61))).toBe('tooLong');
  expect(validateName('Nihal')).toBeUndefined();
});

test('pickup: 6–300 characters, notes up to 500', () => {
  expect(validatePickup('')).toBe('required');
  expect(validatePickup('VIP')).toBe('tooShort');
  expect(validatePickup('Shankar Nagar, Raipur')).toBeUndefined();
  expect(validatePickup('x'.repeat(301))).toBe('tooLong');
  expect(validateNotes('x'.repeat(500))).toBeUndefined();
  expect(validateNotes('x'.repeat(501))).toBe('tooLong');
});

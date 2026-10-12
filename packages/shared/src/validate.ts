/**
 * Field checks for the booking form and the profile. The limits are the ones
 * firestore.rules enforces, so anything that passes here is accepted on save.
 *
 * Checks return an error CODE, not a sentence: each app turns the code into
 * words in the customer's language (English or Hindi).
 */

export type FieldError = 'required' | 'tooShort' | 'tooLong' | 'invalidMobile';

/** Indian mobile numbers: 10 digits starting 6–9 (firestore.rules `isMobile`). */
const MOBILE = /^[6-9]\d{9}$/;

export const LIMITS = {
  name: { min: 2, max: 60 },
  pickup: { min: 6, max: 300 },
  notes: { max: 500 },
  preferredTime: { max: 40 },
} as const;

/** Strips spaces, dashes and a leading +91 / 0, so "+91 91114-73929" → "9111473929". */
export function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

export const isMobile = (raw: string) => MOBILE.test(normalisePhone(raw));

export function validateName(value: string): FieldError | undefined {
  const v = value.trim();
  if (!v) return 'required';
  if (v.length < LIMITS.name.min) return 'tooShort';
  if (v.length > LIMITS.name.max) return 'tooLong';
  return undefined;
}

export function validatePhone(value: string): FieldError | undefined {
  if (!value.trim()) return 'required';
  return isMobile(value) ? undefined : 'invalidMobile';
}

/** A phone number that may be left empty (the profile). */
export function validateOptionalPhone(value: string): FieldError | undefined {
  return value.trim() ? validatePhone(value) : undefined;
}

export function validatePickup(value: string): FieldError | undefined {
  const v = value.trim();
  if (!v) return 'required';
  if (v.length < LIMITS.pickup.min) return 'tooShort';
  if (v.length > LIMITS.pickup.max) return 'tooLong';
  return undefined;
}

export function validateNotes(value: string): FieldError | undefined {
  return value.trim().length > LIMITS.notes.max ? 'tooLong' : undefined;
}

export function validateChoice(value: string): FieldError | undefined {
  return value ? undefined : 'required';
}

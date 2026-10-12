/**
 * A signed-in customer's own records:
 *
 *   users/{uid}                  name, phone, email — the same profile the
 *                                website's My account page edits
 *   users/{uid}/devices/{id}     one per phone with notifications on: the Expo
 *                                push token and the language to write in. The
 *                                alerts robot reads these to send "Driver
 *                                assigned" and other status updates.
 *
 * firestore.rules (website repo) checks both shapes; account.test.ts holds this
 * file to them.
 */

import { type FieldError, normalisePhone, validateName, validateOptionalPhone } from './validate';

export const LANGUAGES = ['en', 'hi'] as const;
export type Language = (typeof LANGUAGES)[number];
export const isLanguage = (v: unknown): v is Language => v === 'en' || v === 'hi';

/* ---------------------------------------------------------------- profile */

export type Profile = { name: string; phone: string; email: string };
export type ProfileErrors = Partial<Record<'name' | 'phone', FieldError>>;

export function validateProfile(p: Profile): ProfileErrors {
  const errors: ProfileErrors = {};
  const name = validateName(p.name);
  const phone = validateOptionalPhone(p.phone);
  if (name) errors.name = name;
  if (phone) errors.phone = phone;
  return errors;
}

/** The fields written to users/{uid} (the caller adds the server timestamps). */
export function profileFields(p: Profile): Profile {
  return {
    name: p.name.trim().replace(/\s+/g, ' '),
    phone: p.phone.trim() ? normalisePhone(p.phone) : '',
    email: p.email,
  };
}

/* ---------------------------------------------------------------- devices */

export const DEVICE_KEYS = ['token', 'platform', 'language', 'updatedAt'] as const;
export const DEVICE_PLATFORMS = ['android', 'ios'] as const;
export type DevicePlatform = (typeof DEVICE_PLATFORMS)[number];

/** Same pattern as firestore.rules: "ExponentPushToken[…]" (or the newer "ExpoPushToken[…]"). */
const EXPO_TOKEN = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{8,200}\]$/;
export const isExpoPushToken = (t: unknown): t is string => typeof t === 'string' && EXPO_TOKEN.test(t);

/** A stable document id for a token: Firestore ids cannot hold every character a token may. */
export function deviceDocId(token: string): string {
  return token.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 150);
}

export type DeviceFields = { token: string; platform: DevicePlatform; language: Language };

/**
 * Words built from data — dates, prices, error codes — in the active language.
 * Pure functions of the message set, so they are easy to test in both languages.
 */

import {
  type Booking,
  type BookingField,
  type FieldError,
  type PackageId,
  type PackagePrice,
  clock12,
  istParts,
  tripInstant,
} from '@drivebuddy/shared';

import type { Messages } from './en';

/** "Thu, 8 Oct" (India time). */
export function formatDay(t: Messages, at: Date | number): string {
  const p = istParts(at);
  return t.dates.day(t.dates.weekdays[p.weekday] ?? '', p.day, t.dates.months[p.month - 1] ?? '');
}

/** "3:30 pm" / "दोपहर 3:30" from 24-hour parts. */
export function formatClock(t: Messages, hour: number, minute: number): string {
  return t.dates.time(hour, clock12(hour, minute).text);
}

/** "Thu, 8 Oct, 3:30 pm" (India time). */
export function formatDateTime(t: Messages, at: Date | number): string {
  const p = istParts(at);
  return t.dates.dateTime(formatDay(t, at), formatClock(t, p.hour, p.minute));
}

/** A stored preferred time ("2026-10-08T15:30" or '') → words. */
export function formatPreferred(t: Messages, raw: string): string {
  if (!raw.trim()) return t.bookings.asap;
  const at = tripInstant(raw);
  return at ? formatDateTime(t, at) : raw;
}

/** "HH:MM" slot → "3:30 pm". */
export function formatSlot(t: Messages, slot: string): string {
  const [h, m] = slot.split(':').map(Number);
  return formatClock(t, h ?? 0, m ?? 0);
}

export function priceLabel(t: Messages, price: PackagePrice): string {
  switch (price.kind) {
    case 'fixed':
      return price.amount;
    case 'from':
      return t.price.from(price.amount);
    case 'monthly':
      return t.price.monthly(price.amount);
    case 'priority':
      return t.price.priority;
    case 'quote':
      return t.price.quote;
  }
}

export const packageName = (t: Messages, id: PackageId | null) =>
  id ? t.packages[id].name : t.unknownPackage;

export const bookingTitle = (t: Messages, b: Pick<Booking, 'packageId'>) => packageName(t, b.packageId);

/** An error code for a field → the sentence for that field. */
export function errorText(t: Messages, field: BookingField, code: FieldError): string {
  const forField = t.errors[field] as Partial<Record<FieldError, string>>;
  return forField[code] ?? t.errors.generic;
}

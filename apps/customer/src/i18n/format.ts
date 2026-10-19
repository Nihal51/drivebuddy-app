/**
 * Words built from data — dates, prices, error codes — in the active language.
 * Pure functions of the message set, so they are easy to test in both languages.
 */

import {
  type Booking,
  type BookingField,
  type BookingQuote,
  type BookingTrip,
  type TripDestination,
  type FieldError,
  type PackageId,
  type PackagePrice,
  clock12,
  indianDigits,
  istParts,
  rupeeRange,
  rupees,
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
    case 'perDay':
      return t.price.perDay(price.amount);
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

/** 1214 → "1,214 km" / "1,214 किमी". */
export const kmText = (t: Messages, km: number) => t.trip.km(indianDigits(km));

/** "2 days" / "3 days + 11 h for the driver to get home". */
export function tripDays(t: Messages, trip: Pick<BookingTrip, 'kind' | 'days' | 'returnHours'>): string {
  const days = t.trip.days(trip.days);
  return trip.kind === 'one-way' && trip.returnHours > 0
    ? `${days} + ${t.trip.returnHours(trip.returnHours)}`
    : days;
}

/**
 * "Raipur → Delhi · one-way drop · 1,214 km · 3 days + 11 h for the driver to get home · estimate ₹5,550–6,150".
 * With `destinations`, a listed place is named in the customer's language.
 */
export function tripSummary(
  t: Messages,
  trip: BookingTrip,
  city: string,
  destinations: readonly TripDestination[] = [],
): string {
  const from = t.cities[city as keyof typeof t.cities] ?? city;
  const dest = trip.destId ? destinations.find((d) => d.id === trip.destId) : undefined;
  const to = dest && t.locale === 'hi-IN' && dest.nameHi ? dest.nameHi : trip.to;
  return [
    `${from} → ${to}`,
    trip.kind === 'round' ? t.trip.summaryRound : t.trip.summaryOneWay,
    trip.km > 0 ? kmText(t, trip.km) : null,
    tripDays(t, trip),
    trip.estFrom > 0
      ? t.trip.estimate(rupeeRange({ from: trip.estFrom, to: trip.estTo }))
      : t.trip.priceOnCall,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** The agreed price, itemised: "₹1,550 × 3 days + ₹1,200 return (11 h) + ₹650 ticket". */
export function quoteBreakdown(t: Messages, q: BookingQuote): string {
  return [
    t.trip.times(rupees(q.dayRate), t.trip.days(q.days)),
    q.returnHours > 0 ? `${rupees(q.returnCharge)} ${t.trip.returnShort(q.returnHours)}` : null,
    q.extraHours > 0 ? t.trip.times(rupees(q.extraHourRate), t.trip.extraHours(q.extraHours)) : null,
    q.ticket > 0 ? t.trip.ticket(rupees(q.ticket)) : null,
  ]
    .filter(Boolean)
    .join(' + ');
}

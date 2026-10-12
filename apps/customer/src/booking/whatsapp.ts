import { type BookingInput, normalisePhone } from '@drivebuddy/shared';

import type { Messages } from '@/i18n';
import { formatPreferred, packageName } from '@/i18n/format';

/**
 * Everything the customer typed, as a WhatsApp message — the way out when the
 * booking cannot be saved (no internet, an outage). Staff read it like a booking.
 */
export function whatsappBookingMessage(t: Messages, v: BookingInput): string {
  const w = t.whatsappBooking;
  return [
    w.intro,
    '',
    `${w.name}: ${v.name.trim()}`,
    `${w.mobile}: ${normalisePhone(v.phone) || v.phone}`,
    v.city ? `${w.city}: ${v.city}` : null,
    `${w.service}: ${packageName(t, v.packageId || null)}`,
    `${w.pickup}: ${v.pickup.trim()}`,
    `${w.when}: ${formatPreferred(t, v.preferredTime)}`,
    v.notes.trim() ? `${w.notes}: ${v.notes.trim()}` : null,
  ]
    .filter((line): line is string => line !== null)
    .join('\n');
}

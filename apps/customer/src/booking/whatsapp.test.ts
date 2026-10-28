import { DEFAULT_CONFIG, EMPTY_BOOKING, planTrip, tripRecord } from '@drivebuddy/shared';

import { en } from '@/i18n/en';
import { hi } from '@/i18n/hi';

import { whatsappBookingMessage } from './whatsapp';

test('a failed booking becomes a complete WhatsApp message', () => {
  const text = whatsappBookingMessage(en, {
    ...EMPTY_BOOKING,
    name: ' Ravi ',
    phone: '+91 98765 43210',
    city: 'Durg',
    packageId: 'outstation',
    pickup: 'Nehru Nagar',
    preferredTime: '2026-10-09T07:00',
    notes: '',
  });
  expect(text).toBe(
    [
      'Hi DriveBuddy, I would like to book a driver.',
      '',
      'Name: Ravi',
      'Mobile: 9876543210',
      'City: Durg',
      'Service: Outstation trip',
      'Pickup: Nehru Nagar',
      'Preferred time: Fri, 9 Oct, 7:00 am',
    ].join('\n'),
  );
});

test('an outstation trip or one-way drop carries the trip and estimate', () => {
  const input = {
    ...EMPTY_BOOKING,
    name: 'Ravi',
    phone: '9876543210',
    city: 'Raipur' as const,
    packageId: 'one-way-drop' as const,
    destId: 'nagpur',
    pickup: 'Shankar Nagar',
  };
  const trip = tripRecord(planTrip(DEFAULT_CONFIG, 'one-way-drop', 'Raipur', 'nagpur'), '');
  expect(whatsappBookingMessage(en, input, trip)).toContain(
    'Trip: Raipur → Nagpur · one-way drop · 284 km · 1 day + 6 h for the driver to get home · estimate ₹1,440',
  );
  expect(whatsappBookingMessage(hi, input, trip)).toContain('ट्रिप: रायपुर → Nagpur');
  expect(whatsappBookingMessage(hi, input, trip, DEFAULT_CONFIG.destinations)).toContain(
    'ट्रिप: रायपुर → नागपुर',
  );
});

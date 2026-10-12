import { en } from '@/i18n/en';

import { whatsappBookingMessage } from './whatsapp';

test('a failed booking becomes a complete WhatsApp message', () => {
  const text = whatsappBookingMessage(en, {
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

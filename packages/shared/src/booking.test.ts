import {
  BOOKING_CREATE_KEYS,
  type BookingInput,
  EMPTY_BOOKING,
  hasErrors,
  newBookingFields,
  sortNewestFirst,
  toBooking,
  validateBooking,
} from './booking';

const GOOD: BookingInput = {
  name: '  Ravi   Sharma ',
  phone: '+91 98765 43210',
  city: 'Raipur',
  packageId: 'local-full-day',
  pickup: ' Shankar Nagar, near the temple ',
  preferredTime: '2026-10-09T09:00',
  notes: '',
};

test('an empty form lists every required field', () => {
  expect(validateBooking(EMPTY_BOOKING)).toEqual({
    name: 'required',
    phone: 'required',
    city: 'required',
    packageId: 'required',
    pickup: 'required',
  });
});

test('a good booking becomes exactly the fields firestore.rules accepts', () => {
  expect(hasErrors(validateBooking(GOOD))).toBe(false);
  const fields = newBookingFields(GOOD, 'uid-123');
  expect(fields).toEqual({
    name: 'Ravi Sharma',
    phone: '9876543210',
    city: 'Raipur',
    package: 'local-full-day',
    pickup: 'Shankar Nagar, near the temple',
    preferredTime: '2026-10-09T09:00',
    notes: '',
    status: 'new',
    source: 'app',
    customerUid: 'uid-123',
  });
  // Every key is allowed by the rules (createdAt is added at write time)…
  for (const key of Object.keys(fields)) expect(BOOKING_CREATE_KEYS).toContain(key);
  // …and a guest booking leaves customerUid out entirely, as the rules require.
  expect(newBookingFields(GOOD)).not.toHaveProperty('customerUid');
});

test('an unchecked booking can never be turned into fields', () => {
  expect(() => newBookingFields({ ...GOOD, phone: '123' })).toThrow();
});

test('stored documents are read defensively', () => {
  const b = toBooking('abc', {
    name: 'Ravi',
    package: 'some-future-package',
    status: 'weird',
    assignedDriver: { id: 'd1', name: 'Suresh', phone: '9876500000' },
    createdAt: { toDate: () => new Date('2026-10-08T10:00:00Z') },
  });
  expect(b.packageId).toBeNull();
  expect(b.packageRaw).toBe('some-future-package');
  expect(b.status).toBe('new');
  expect(b.assignedDriver?.name).toBe('Suresh');
  expect(b.createdAt?.toISOString()).toBe('2026-10-08T10:00:00.000Z');
  expect(toBooking('x', { assignedDriver: null }).assignedDriver).toBeUndefined();
});

test('newest first, with a just-written booking (no server time yet) on top', () => {
  const at = (iso?: string) => toBooking(iso ?? 'pending', iso ? { createdAt: new Date(iso) } : {});
  const sorted = sortNewestFirst([at('2026-10-01T00:00:00Z'), at(), at('2026-10-05T00:00:00Z')]);
  expect(sorted.map((b) => b.id)).toEqual(['pending', '2026-10-05T00:00:00Z', '2026-10-01T00:00:00Z']);
});

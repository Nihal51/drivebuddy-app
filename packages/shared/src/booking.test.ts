import {
  BOOKING_CREATE_KEYS,
  BOOKING_FIELDS,
  type BookingInput,
  EMPTY_BOOKING,
  hasErrors,
  newBookingFields,
  sortNewestFirst,
  toBooking,
  validateBooking,
} from './booking';
import { DEFAULT_CONFIG } from './config';
import { ELSEWHERE, TRIP_KEYS, planTrip, tripRecord } from './trip';

const GOOD: BookingInput = {
  name: '  Ravi   Sharma ',
  phone: '+91 98765 43210',
  city: 'Raipur',
  packageId: 'local-full-day',
  destId: '',
  destOther: '',
  days: '',
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

test('a trip package needs a destination, and a typed place for "somewhere else"', () => {
  const drop: BookingInput = { ...GOOD, packageId: 'one-way-drop' };
  expect(validateBooking(drop)).toEqual({ destId: 'required' });
  expect(validateBooking({ ...drop, destId: ELSEWHERE })).toEqual({ destOther: 'required' });
  expect(validateBooking({ ...drop, destId: ELSEWHERE, destOther: 'Jaipur' })).toEqual({});
  expect(validateBooking({ ...drop, destId: 'nagpur', days: '0' })).toEqual({ days: 'invalidNumber' });
  expect(validateBooking({ ...drop, destId: 'nagpur', days: '2.5' })).toEqual({ days: 'invalidNumber' });
  expect(validateBooking({ ...drop, destId: 'nagpur', days: '3' })).toEqual({});
  // Other packages ignore the trip fields.
  expect(validateBooking({ ...GOOD, destId: '', days: 'x' })).toEqual({});
  expect(BOOKING_FIELDS).toContain('destId');
});

test('a trip is saved only on a trip package, and only with the matching kind', () => {
  const drop: BookingInput = { ...GOOD, packageId: 'one-way-drop', destId: 'nagpur' };
  const trip = tripRecord(planTrip(DEFAULT_CONFIG, 'one-way-drop', 'Raipur', 'nagpur'), '');
  const fields = newBookingFields(drop, null, trip);
  expect(fields.trip).toEqual({
    to: 'Nagpur',
    destId: 'nagpur',
    kind: 'one-way',
    km: 284,
    days: 1,
    returnDays: 1,
    estFrom: 2450,
    estTo: 2850,
  });
  expect(Object.keys(fields.trip ?? {}).sort()).toEqual([...TRIP_KEYS].sort());
  for (const key of Object.keys(fields)) expect(BOOKING_CREATE_KEYS).toContain(key);
  expect(newBookingFields(GOOD, null, trip)).not.toHaveProperty('trip');
  expect(newBookingFields({ ...drop, packageId: 'outstation' }, null, trip)).not.toHaveProperty('trip');
});

test('the trip and the agreed price are read back', () => {
  const b = toBooking('t', {
    package: 'one-way-drop',
    trip: {
      to: 'Nagpur',
      destId: 'nagpur',
      kind: 'one-way',
      km: 284,
      days: 1,
      returnDays: 1,
      estFrom: 2450,
      estTo: 2650,
    },
    quote: {
      amount: 2700,
      dayRate: 1550,
      days: 1,
      returnDays: 1,
      returnDay: 1000,
      extraHours: 0,
      extraHourRate: 120,
      ticket: 150,
      at: new Date(),
    },
  });
  expect(b.trip?.to).toBe('Nagpur');
  expect(b.quote?.amount).toBe(2700);
  const odd = toBooking('o', { trip: { to: 'X', km: '284' }, quote: { amount: -1 } });
  expect(odd.trip).toBeUndefined();
  expect(odd.quote).toBeUndefined();
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

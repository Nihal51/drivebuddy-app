import { type Booking, toBooking } from '@drivebuddy/shared';

import {
  canAcceptPrice,
  canRate,
  confirmedInstantly,
  findingDriver,
  priceAcceptedWaiting,
} from './selfserve';

const TRIP = {
  to: 'Nagpur',
  destId: 'nagpur',
  kind: 'one-way',
  km: 284,
  days: 1,
  returnHours: 8,
  estFrom: 1700,
  estTo: 1700,
};
const DRIVER = { id: 'd1', name: 'Suresh', phone: '9876500000' };

const booking = (data: Record<string, unknown>): Booking =>
  toBooking('b1', { package: 'one-way-drop', status: 'new', customerUid: 'u1', trip: TRIP, ...data });

describe('Accept price', () => {
  test('the customer who booked a priced trip can accept it, while new or confirmed', () => {
    expect(canAcceptPrice(booking({}), 'u1')).toBe(true);
    expect(canAcceptPrice(booking({ status: 'confirmed' }), 'u1')).toBe(true);
  });

  test('nobody else, never twice, and never once a driver is on it', () => {
    expect(canAcceptPrice(booking({}), 'someone-else')).toBe(false);
    expect(canAcceptPrice(booking({}), null)).toBe(false);
    expect(canAcceptPrice(booking({ customerUid: undefined }), 'u1')).toBe(false); // a guest booking
    expect(canAcceptPrice(booking({ acceptedPrice: { amount: 1700, at: null } }), 'u1')).toBe(false);
    for (const status of ['assigned', 'completed', 'cancelled'])
      expect(canAcceptPrice(booking({ status }), 'u1')).toBe(false);
  });

  test('only with an estimate, and not once the team agreed a price on the call', () => {
    expect(canAcceptPrice(booking({ trip: { ...TRIP, estFrom: 0, estTo: 0 } }), 'u1')).toBe(false);
    expect(canAcceptPrice(booking({ trip: undefined, package: '3-hours-600' }), 'u1')).toBe(false);
    const quote = {
      amount: 1800,
      dayRate: 1800,
      days: 1,
      returnHours: 0,
      returnHourRate: 0,
      returnCharge: 0,
      extraHours: 0,
      extraHourRate: 130,
      ticket: 0,
    };
    expect(canAcceptPrice(booking({ quote }), 'u1')).toBe(false);
  });

  test('after accepting: waiting for a driver until one is assigned', () => {
    const accepted = { acceptedPrice: { amount: 1700 } };
    expect(priceAcceptedWaiting(booking(accepted))).toBe(true);
    expect(priceAcceptedWaiting(booking({ ...accepted, status: 'confirmed' }))).toBe(true);
    expect(priceAcceptedWaiting(booking({ ...accepted, status: 'assigned', assignedDriver: DRIVER }))).toBe(
      false,
    );
    expect(priceAcceptedWaiting(booking({}))).toBe(false);
  });
});

describe('status wording', () => {
  test('confirmed by the robot reads "confirmed instantly"; by the team it does not', () => {
    expect(confirmedInstantly(booking({ status: 'confirmed', updatedBy: 'robot' }))).toBe(true);
    expect(confirmedInstantly(booking({ status: 'confirmed', updatedBy: 'admin-uid' }))).toBe(false);
    expect(
      confirmedInstantly(booking({ status: 'assigned', updatedBy: 'robot', assignedDriver: DRIVER })),
    ).toBe(false);
  });

  test('finding a driver while confirmed and nobody has the job', () => {
    expect(findingDriver(booking({ status: 'confirmed' }))).toBe(true);
    expect(findingDriver(booking({ status: 'new' }))).toBe(false);
    expect(findingDriver(booking({ status: 'assigned', assignedDriver: DRIVER }))).toBe(false);
  });
});

describe('rating', () => {
  const done = { status: 'completed', assignedDriver: DRIVER };

  test('the customer rates a finished job that had a driver', () => {
    expect(canRate(booking(done), 'u1')).toBe(true);
  });

  test('not someone else, not before the end, not without a driver id', () => {
    expect(canRate(booking(done), 'u2')).toBe(false);
    expect(canRate(booking(done), undefined)).toBe(false);
    expect(canRate(booking({ ...done, status: 'assigned' }), 'u1')).toBe(false);
    expect(canRate(booking({ ...done, assignedDriver: undefined }), 'u1')).toBe(false);
    expect(canRate(booking({ ...done, assignedDriver: { ...DRIVER, id: '' } }), 'u1')).toBe(false);
    expect(canRate(booking({ ...done, customerUid: undefined }), 'u1')).toBe(false);
  });
});

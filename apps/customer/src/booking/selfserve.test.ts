import { type Booking, toBooking, toPayment } from '@drivebuddy/shared';

import {
  canAcceptPrice,
  canChangeDriver,
  canRate,
  confirmedInstantly,
  driverView,
  findingAnotherDriver,
  findingDriver,
  paymentView,
  priceAcceptedWaiting,
  showsDriver,
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

describe('the driver, as the customer sees him (SPEC-privacy)', () => {
  const CARD = {
    name: 'Suresh Verma',
    photoUrl: null,
    rating: 4.8,
    ratingCount: 23,
    trips: 120,
    experienceYears: 8,
    verified: true,
    since: null,
  };
  const ON = {
    status: 'assigned',
    assignedDriver: DRIVER,
    driverConfirmed: { by: 'robot', driverId: 'd1' },
    driverCard: CARD,
  };

  test('only once DriveBuddy has confirmed him and his card is made — never from the booking alone', () => {
    expect(showsDriver(booking(ON))).toBe(true);
    expect(showsDriver(booking({ ...ON, driverCard: undefined }))).toBe(false);
    expect(showsDriver(booking({ ...ON, driverConfirmed: undefined }))).toBe(false);
    // A confirmation of the driver it had before is not one of him.
    expect(showsDriver(booking({ ...ON, driverConfirmed: { by: 'robot', driverId: 'd0' } }))).toBe(false);
    expect(showsDriver(booking({ ...ON, assignedDriver: { name: 'Suresh', phone: '9876500000' } }))).toBe(
      false,
    );
  });

  test('what the screen shows: confirming, his card, or finding another', () => {
    expect(driverView(booking({ ...ON, driverCard: undefined }), 'u1', false)).toEqual({
      kind: 'confirming',
    });
    const card = driverView(booking(ON), 'u1', false);
    expect(card).toEqual({ kind: 'card', card: CARD, current: true, changesLeft: 2, canChange: true });
    // The card is never the driver's number.
    expect(JSON.stringify(card)).not.toContain('9876500000');
    expect(driverView(booking({ ...ON, status: 'completed' }), 'u1', false)).toMatchObject({
      kind: 'card',
      current: false,
      canChange: false,
    });
    expect(
      driverView(booking({ ...ON, driverChangeRequest: { at: null, reason: '' } }), 'u1', false),
    ).toEqual({
      kind: 'finding-another',
    });
    expect(driverView(booking({ status: 'confirmed' }), 'u1', false)).toEqual({ kind: 'none' });
    expect(driverView(booking({ ...ON, status: 'cancelled' }), 'u1', false)).toEqual({ kind: 'none' });
  });

  test('finding you another driver: asked for, then back to confirmed with nobody on it yet', () => {
    expect(findingAnotherDriver(booking({ ...ON, driverChangeRequest: { reason: 'Too far' } }))).toBe(true);
    expect(findingAnotherDriver(booking({ status: 'confirmed', driverChanges: 1 }))).toBe(true);
    expect(findingAnotherDriver(booking({ status: 'confirmed' }))).toBe(false); // the first driver
    expect(findingAnotherDriver(booking({ ...ON, driverChanges: 1 }))).toBe(false); // found him
  });

  test('Change driver: his customer, twice per booking, one at a time, before he sets off', () => {
    expect(canChangeDriver(booking(ON), 'u1', false)).toBe(true);
    expect(canChangeDriver(booking({ ...ON, driverChanges: 1 }), 'u1', false)).toBe(true);
    expect(driverView(booking({ ...ON, driverChanges: 1 }), 'u1', false)).toMatchObject({ changesLeft: 1 });
    expect(canChangeDriver(booking({ ...ON, driverChanges: 2 }), 'u1', false)).toBe(false);
    expect(canChangeDriver(booking(ON), 'u2', false)).toBe(false);
    expect(canChangeDriver(booking(ON), null, false)).toBe(false);
    expect(canChangeDriver(booking({ ...ON, driverChangeRequest: { reason: '' } }), 'u1', false)).toBe(false);
    // Set off: the trip clock, or he is sharing his location (that starts with his Start tap).
    expect(canChangeDriver(booking({ ...ON, clock: { startAt: new Date() } }), 'u1', false)).toBe(false);
    expect(canChangeDriver(booking(ON), 'u1', true)).toBe(false);
    // Not before DriveBuddy has confirmed him, nor after the job.
    expect(canChangeDriver(booking({ ...ON, driverCard: undefined }), 'u1', false)).toBe(false);
    expect(canChangeDriver(booking({ ...ON, status: 'completed' }), 'u1', false)).toBe(false);
  });
});

describe('payment card', () => {
  const UPI = 'upi://pay?pa=drivebuddy%40ybl&pn=DriveBuddy&am=750.00&cu=INR&tn=DB-1042';
  const view = (p: Record<string, unknown>) => paymentView(toPayment({ amount: 750, ...p })!);

  test('a pending UPI link opens the UPI app; a Razorpay link the page', () => {
    expect(view({ status: 'pending', method: 'upi', url: UPI })).toEqual({
      kind: 'pay',
      url: UPI,
      upi: true,
    });
    expect(view({ status: 'pending', url: 'https://rzp.io/i/x' })).toEqual({
      kind: 'pay',
      url: 'https://rzp.io/i/x',
      upi: false,
    });
  });

  test('no link that may open: a UPI payment goes to the driver, a Razorpay one to the SMS', () => {
    expect(view({ status: 'pending', method: 'upi', url: 'upi://payx?pa=thief@ybl' })).toEqual({
      kind: 'pay-driver',
    });
    expect(view({ status: 'pending', url: 'upi://pay?pa=thief' })).toEqual({ kind: 'pay-driver' });
    expect(view({ status: 'pending', url: UPI.replace('750.00', '75.00') })).toEqual({ kind: 'pay-driver' });
    expect(view({ status: 'pending', url: 'https://evil.example/pay' })).toEqual({ kind: 'by-sms' });
  });

  test('paid says how', () => {
    expect(view({ status: 'paid', method: 'cash' })).toEqual({ kind: 'paid', method: 'cash' });
    expect(view({ status: 'paid', method: 'upi', url: UPI })).toEqual({ kind: 'paid', method: 'upi' });
    expect(view({ status: 'paid', url: 'https://rzp.io/i/x' })).toEqual({ kind: 'paid', method: undefined });
  });
});

/**
 * What the booking screen offers without a call (automation spec items 1, 2,
 * 6, 7). Pure functions of the booking and the login, so each rule the
 * website's firestore.rules enforces is also checked — and tested — here,
 * and the customer never sees a button the server would refuse.
 */

import {
  type Booking,
  type DriverCard,
  type Payment,
  driverChangesLeft,
  payKind,
  payUrl,
} from '@drivebuddy/shared';

/**
 * "Accept price ₹X" on a trip estimate: only the customer who made the
 * booking while logged in, only before a driver is on it (new / confirmed),
 * only once. Not when the team has already agreed a price on the call — the
 * robot prices by that quote first, so accepting the estimate would change
 * nothing.
 */
export function canAcceptPrice(b: Booking, uid: string | null | undefined): boolean {
  return (
    Boolean(uid) &&
    b.customerUid === uid &&
    (b.status === 'new' || b.status === 'confirmed') &&
    (b.trip?.estTo ?? 0) > 0 &&
    !b.acceptedPrice &&
    !b.quote
  );
}

/** The price the customer accepted, while the robot confirms it and a driver is found. */
export const priceAcceptedWaiting = (b: Booking): boolean =>
  Boolean(b.acceptedPrice) && (b.status === 'new' || b.status === 'confirmed') && !b.assignedDriver;

/** Confirmed by the alerts robot on its own (instant booking), not by the team on a call. */
export const confirmedInstantly = (b: Booking): boolean =>
  b.status === 'confirmed' && b.updatedBy === 'robot';

/** Confirmed and offered to drivers, nobody has taken it yet. */
export const findingDriver = (b: Booking): boolean => b.status === 'confirmed' && !b.assignedDriver;

/* ------------------------------------------------------------ the driver */
// SPEC-privacy (25 Nov 2026): customers never get the driver's number, like
// Rapido. They see who he is — his card — once DriveBuddy has confirmed him,
// and call DriveBuddy, never him.

/**
 * The customer sees the driver only once DriveBuddy has confirmed him on the
 * booking (driverConfirmed names the driver it has now) and the robot has made
 * his card. Before that: "Driver found — DriveBuddy is confirming him".
 */
export const showsDriver = (b: Pick<Booking, 'assignedDriver' | 'driverConfirmed' | 'driverCard'>): boolean =>
  Boolean(b.assignedDriver?.id && b.driverCard && b.driverConfirmed?.driverId === b.assignedDriver.id);

/**
 * "Finding you another driver": the customer asked for another one (until the
 * robot takes it, seconds later), or the robot has put the booking back to
 * confirmed after a change and nobody has taken it yet.
 */
export const findingAnotherDriver = (b: Booking): boolean =>
  (b.status === 'assigned' && Boolean(b.driverChangeRequest)) ||
  (b.status === 'confirmed' && !b.assignedDriver && b.driverChanges > 0);

/**
 * "Change driver": the customer who booked it, while his confirmed driver is
 * on it, none asked for yet, changes left (2 per booking), and before he
 * has set off. firestore.rules checks the same, and also his Start tap —
 * which the customer cannot read, so `started` stands for it: he is sharing
 * his location (that begins with Start). The server refuses the rest.
 */
export function canChangeDriver(b: Booking, uid: string | null | undefined, started: boolean): boolean {
  return (
    Boolean(uid) &&
    b.customerUid === uid &&
    b.status === 'assigned' &&
    showsDriver(b) &&
    !b.driverChangeRequest &&
    driverChangesLeft(b) > 0 &&
    !b.clock?.startAt &&
    !started
  );
}

/** What the booking screen shows of the driver. */
export type DriverView =
  | { kind: 'none' }
  /** He took the job; DriveBuddy has not confirmed him yet. */
  | { kind: 'confirming' }
  | { kind: 'finding-another' }
  | {
      kind: 'card';
      card: DriverCard;
      /** The job is still on (Call DriveBuddy); false once completed. */
      current: boolean;
      changesLeft: number;
      canChange: boolean;
    };

export function driverView(b: Booking, uid: string | null | undefined, started: boolean): DriverView {
  if (findingAnotherDriver(b)) return { kind: 'finding-another' };
  if (b.status !== 'assigned' && b.status !== 'completed') return { kind: 'none' };
  if (b.driverCard && showsDriver(b)) {
    return {
      kind: 'card',
      card: b.driverCard,
      current: b.status === 'assigned',
      changesLeft: driverChangesLeft(b),
      canChange: canChangeDriver(b, uid, started),
    };
  }
  return b.status === 'assigned' && b.assignedDriver ? { kind: 'confirming' } : { kind: 'none' };
}

/**
 * The rating card: a finished job with a known driver, by the customer who
 * booked it (firestore.rules: driverId == assignedDriver.id, the booking's
 * customer). Whether it is already rated is asked separately.
 */
export function canRate(b: Booking, uid: string | null | undefined): boolean {
  return Boolean(uid) && b.customerUid === uid && b.status === 'completed' && Boolean(b.assignedDriver?.id);
}

/** What the payment card shows (SPEC-upi item 8). */
export type PaymentView =
  | { kind: 'paid'; method: Payment['method'] }
  /** A checked link: a UPI app (`upi`) or the Razorpay page. */
  | { kind: 'pay'; url: string; upi: boolean }
  /** A UPI payment with no link that may open: he pays the driver, or the QR the driver shows. */
  | { kind: 'pay-driver' }
  /** A Razorpay payment with no link that may open: Razorpay also sent it by SMS. */
  | { kind: 'by-sms' };

export function paymentView(p: Payment): PaymentView {
  if (p.status === 'paid') return { kind: 'paid', method: p.method };
  const url = payUrl(p);
  if (url) return { kind: 'pay', url, upi: payKind(url) === 'upi' };
  return p.method === 'upi' || p.method === 'cash' || /^upi:/i.test(p.url)
    ? { kind: 'pay-driver' }
    : { kind: 'by-sms' };
}

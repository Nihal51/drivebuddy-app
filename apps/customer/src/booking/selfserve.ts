/**
 * What the booking screen offers without a call (automation spec items 1, 2,
 * 6, 7). Pure functions of the booking and the login, so each rule the
 * website's firestore.rules enforces is also checked — and tested — here,
 * and the customer never sees a button the server would refuse.
 */

import { type Booking, type Payment, payKind, payUrl } from '@drivebuddy/shared';

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

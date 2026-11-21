/**
 * Self-serve booking (DriveBuddy automation, phases 1–2): the fields that let
 * a simple booking go from "Book" to "Paid" without a call to the office.
 *
 * - `acceptedPrice` — written by the customer in the app: "Accept price ₹X"
 *   on a trip estimate. The alerts robot then confirms the booking itself.
 * - `localBill` — written by the robot when the driver taps "Job done" on a
 *   local package: the package plus the hours over it.
 * - `payment` — written by the robot: the Razorpay payment link, then "paid".
 * - `ratings/{bookingId}` — created once by the customer after the job.
 *
 * The robot and the website may be a version ahead or behind this app, so
 * every reader below accepts a missing or odd field and simply leaves it out.
 */

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const int = (v: unknown, max = 1_000_000) =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max ? v : null;

/**
 * Firestore Timestamp | Date → Date. A field just written with
 * serverTimestamp() reads back as null until the server answers, so a
 * missing time never makes the whole field unreadable.
 */
function when(v: unknown): Date | undefined {
  if (v instanceof Date) return v;
  if (isObj(v) && typeof v.toDate === 'function') return (v.toDate as () => Date).call(v);
  return undefined;
}

/* ------------------------------------------------------- accepted price */

/** The trip estimate the customer accepted in the app (firestore.rules: amount == trip.estTo). */
export type AcceptedPrice = { amount: number; at?: Date };

export function toAcceptedPrice(v: unknown): AcceptedPrice | undefined {
  if (!isObj(v)) return undefined;
  const amount = int(v.amount);
  if (!amount) return undefined;
  const at = when(v.at);
  return at ? { amount, at } : { amount };
}

/* ----------------------------------------------------------- local bill */

/** The robot's bill for a local package, from the driver's Arrived and Job done taps. */
export type LocalBill = {
  amount: number;
  /** The hours in the package (1 / 3 / 8 / 10). */
  baseHours: number;
  /** Whole hours from Arrived to Job done, rounded up after a short grace. */
  usedHours: number;
  extraHours: number;
  extraHourRate: number;
  at?: Date;
};

export function toLocalBill(v: unknown): LocalBill | undefined {
  if (!isObj(v)) return undefined;
  const amount = int(v.amount);
  const nums = [
    int(v.baseHours, 1000),
    int(v.usedHours, 1000),
    int(v.extraHours, 1000),
    int(v.extraHourRate),
  ];
  if (!amount || nums.some((n) => n === null)) return undefined;
  const [baseHours, usedHours, extraHours, extraHourRate] = nums as number[];
  const bill: LocalBill = {
    amount,
    baseHours: baseHours as number,
    usedHours: usedHours as number,
    extraHours: extraHours as number,
    extraHourRate: extraHourRate as number,
  };
  const at = when(v.at);
  if (at) bill.at = at;
  return bill;
}

/** The package part of a local bill (the total less the extra hours), or null if the numbers do not add up. */
export function localBillPackage(b: LocalBill): number | null {
  const pkg = b.amount - b.extraHours * b.extraHourRate;
  return pkg > 0 ? pkg : null;
}

/* -------------------------------------------------------------- payment */

export const PAYMENT_STATUSES = ['pending', 'paid'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** The Razorpay payment link the robot made for a completed booking. */
export type Payment = {
  status: PaymentStatus;
  amount: number;
  /** As stored: check it with payUrl before opening it. */
  url: string;
  linkId?: string;
  at?: Date;
  paidAt?: Date;
};

export function toPayment(v: unknown): Payment | undefined {
  if (!isObj(v)) return undefined;
  const status = PAYMENT_STATUSES.find((s) => s === v.status);
  const amount = int(v.amount);
  if (!status || !amount) return undefined;
  const p: Payment = { status, amount, url: typeof v.url === 'string' ? v.url.trim() : '' };
  if (typeof v.linkId === 'string' && v.linkId) p.linkId = v.linkId;
  const at = when(v.at);
  if (at) p.at = at;
  const paidAt = when(v.paidAt);
  if (paidAt) p.paidAt = paidAt;
  return p;
}

/**
 * Only a Razorpay page may open from the Pay button: https, and the host is
 * exactly rzp.io (the payment-link short URL) or razorpay.com — so a bad or
 * tampered `url` can never send the customer's money somewhere else. A
 * regular expression rather than `URL`, whose React Native version is
 * incomplete; the host must end at "/", "?", "#" or the end, which rules out
 * "https://rzp.io@evil.example" and "https://rzp.io.evil.example".
 */
const PAY_URL = /^https:\/\/(rzp\.io|razorpay\.com)([/?#][^\s\\]*)?$/i;

export const isPaymentUrl = (url: unknown): url is string =>
  typeof url === 'string' && url.length <= 500 && PAY_URL.test(url);

/** The link the Pay button opens, or null when there is nothing safe to open. */
export const payUrl = (p: Payment | undefined): string | null =>
  p && p.status === 'pending' && isPaymentUrl(p.url) ? p.url : null;

/* -------------------------------------------------------------- ratings */

/** Every field firestore.rules allows on `ratings/{bookingId}` (`at` is the server's clock). */
export const RATING_KEYS = ['stars', 'comment', 'driverId', 'customerUid', 'at'] as const;
export const RATING_COMMENT_MAX = 300;

export const isStars = (v: unknown): v is 1 | 2 | 3 | 4 | 5 =>
  typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 5;

export type NewRatingFields = { stars: number; comment: string; driverId: string; customerUid: string };

/**
 * The rating to write (the caller adds `at` as the server timestamp), or null
 * if it would be refused: stars outside 1–5, a comment over the limit, or no
 * driver / customer. The comment is trimmed and its spaces tidied first.
 */
export function newRatingFields(
  stars: number,
  comment: string,
  driverId: string,
  customerUid: string,
): NewRatingFields | null {
  const text = comment.trim().replace(/[ \t]+/g, ' ');
  if (!isStars(stars) || text.length > RATING_COMMENT_MAX || !driverId || !customerUid) return null;
  return { stars, comment: text, driverId, customerUid };
}

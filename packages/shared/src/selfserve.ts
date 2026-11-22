/**
 * Self-serve booking (DriveBuddy automation, phases 1–2): the fields that let
 * a simple booking go from "Book" to "Paid" without a call to the office.
 *
 * - `acceptedPrice` — written by the customer in the app: "Accept price ₹X"
 *   on a trip estimate. The alerts robot then confirms the booking itself.
 * - `localBill` — written by the robot when the driver taps "Job done" on a
 *   local package: the package plus the hours over it.
 * - `payment` — written by the robot: the pay link (a Razorpay page, or a
 *   `upi://pay?` link to DriveBuddy's UPI ID), then "paid" — by Razorpay, or
 *   once the driver taps "Paid by UPI" / "Paid in cash" in the Driver app.
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

/** How it was paid: a UPI app, cash to the driver, or a Razorpay page. */
export const PAYMENT_METHODS = ['upi', 'cash', 'razorpay'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** The robot's pay link for a completed booking, and whether it is paid. */
export type Payment = {
  status: PaymentStatus;
  amount: number;
  /** As stored: check it with payUrl before opening it. '' once the driver recorded the payment. */
  url: string;
  /** Absent on payments from before UPI (those were Razorpay). */
  method?: PaymentMethod;
  /** Who confirmed it was paid ('driver' when he tapped Paid by UPI / in cash). */
  by?: string;
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
  const method = PAYMENT_METHODS.find((m) => m === v.method);
  if (method) p.method = method;
  if (typeof v.by === 'string' && v.by && v.by.length <= 40) p.by = v.by;
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

/** The same UPI ID pattern as the website's firestore.rules and the robot's UPI_ID check. */
export const UPI_ID_PATTERN = /^[a-zA-Z0-9.\-_]{2,64}@[a-zA-Z]{2,32}$/;

/**
 * A UPI pay link as the robot makes it:
 * `upi://pay?pa=<UPI ID>&pn=<name>&am=750.00&cu=INR&tn=<ref>`, each value
 * encodeURIComponent-ed. The UPI app pays whoever `pa` names, so: exactly one
 * `pa`, a real UPI ID; only the characters encodeURIComponent leaves, and "@" (no
 * spaces, "#", "/" or a second "?"); and an amount and currency, when given,
 * that read as rupees. Lower-case `upi://pay?` only.
 */
const URI_CHAR = "[A-Za-z0-9\\-_.!~*'()%@]";
const UPI_LINK = new RegExp(`^upi://pay\\?${URI_CHAR}+=${URI_CHAR}*(&${URI_CHAR}+=${URI_CHAR}*)*$`);

/** The link's `name=value` pairs (decoded), or null when one does not decode. */
function upiParams(url: string): [string, string][] | null {
  try {
    return url
      .slice('upi://pay?'.length)
      .split('&')
      .map((pair) => {
        const i = pair.indexOf('=');
        return [decodeURIComponent(pair.slice(0, i)), decodeURIComponent(pair.slice(i + 1))];
      });
  } catch {
    return null;
  }
}

/** The UPI link's amount in rupees, null when it has none, NaN when it is not one. */
function upiAmount(params: [string, string][]): number | null {
  const am = params.filter(([k]) => k === 'am');
  if (am.length === 0) return null;
  const v = am.length === 1 ? (am[0] as [string, string])[1] : '';
  return /^\d{1,7}(\.\d{1,2})?$/.test(v) ? Number(v) : NaN;
}

export function isUpiPayUrl(url: unknown): url is string {
  if (typeof url !== 'string' || url.length > 500 || !UPI_LINK.test(url)) return false;
  const params = upiParams(url);
  if (!params) return false;
  const pa = params.filter(([k]) => k === 'pa');
  if (pa.length !== 1 || !UPI_ID_PATTERN.test((pa[0] as [string, string])[1])) return false;
  const cu = params.filter(([k]) => k === 'cu');
  if (cu.length > 1 || (cu.length === 1 && (cu[0] as [string, string])[1] !== 'INR')) return false;
  return !Number.isNaN(upiAmount(params));
}

export const isRazorpayUrl = (url: unknown): url is string =>
  typeof url === 'string' && url.length <= 500 && PAY_URL.test(url);

/** A link the Pay button may open: a Razorpay page or a UPI pay link. */
export const isPaymentUrl = (url: unknown): url is string => isRazorpayUrl(url) || isUpiPayUrl(url);

/**
 * The link the Pay button opens, or null when there is nothing safe to open.
 * A UPI link must also ask for the amount the button shows (or leave it to the
 * customer), so "Pay ₹750" can never charge something else.
 */
export function payUrl(p: Payment | undefined): string | null {
  if (!p || p.status !== 'pending' || !isPaymentUrl(p.url)) return null;
  if (isUpiPayUrl(p.url)) {
    const am = upiAmount(upiParams(p.url) ?? []);
    if (am !== null && am !== p.amount) return null;
  }
  return p.url;
}

/** How the pay link pays: 'upi' opens a UPI app, 'razorpay' a web page. */
export const payKind = (url: string): 'upi' | 'razorpay' => (isUpiPayUrl(url) ? 'upi' : 'razorpay');

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

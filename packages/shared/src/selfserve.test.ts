import { toBooking } from './booking';
import {
  RATING_COMMENT_MAX,
  RATING_KEYS,
  isPaymentUrl,
  isRazorpayUrl,
  isUpiPayUrl,
  localBillPackage,
  newRatingFields,
  payKind,
  payUrl,
  toAcceptedPrice,
  toLocalBill,
  toPayment,
} from './selfserve';

const ts = (iso: string) => ({ toDate: () => new Date(iso) });

describe('accepted price', () => {
  test('is read back with its time, or without it while the server time is pending', () => {
    expect(toAcceptedPrice({ amount: 5250, at: ts('2026-11-20T10:00:00Z') })).toEqual({
      amount: 5250,
      at: new Date('2026-11-20T10:00:00Z'),
    });
    // Just written with serverTimestamp(): the local copy has at: null.
    expect(toAcceptedPrice({ amount: 5250, at: null })).toEqual({ amount: 5250 });
  });

  test('odd values are left out', () => {
    for (const v of [
      null,
      undefined,
      'x',
      [],
      {},
      { amount: 0 },
      { amount: -5 },
      { amount: 12.5 },
      { amount: '5250' },
    ])
      expect(toAcceptedPrice(v)).toBeUndefined();
  });
});

describe('local bill', () => {
  const BILL = {
    amount: 900,
    baseHours: 3,
    usedHours: 5,
    extraHours: 2,
    extraHourRate: 150,
    at: ts('2026-11-20T14:00:00Z'),
  };

  test('is read back whole', () => {
    expect(toLocalBill(BILL)).toEqual({ ...BILL, at: new Date('2026-11-20T14:00:00Z') });
    expect(toLocalBill({ ...BILL, at: null })).not.toHaveProperty('at');
  });

  test('a missing or odd number drops the bill rather than showing a wrong one', () => {
    expect(toLocalBill(undefined)).toBeUndefined();
    expect(toLocalBill({ ...BILL, amount: 0 })).toBeUndefined();
    expect(toLocalBill({ ...BILL, extraHours: '2' })).toBeUndefined();
    expect(toLocalBill({ ...BILL, usedHours: -1 })).toBeUndefined();
    const { baseHours: _b, ...noBase } = BILL;
    expect(toLocalBill(noBase)).toBeUndefined();
  });

  test('the package part is the total less the extra hours', () => {
    expect(localBillPackage(toLocalBill(BILL)!)).toBe(600);
    expect(localBillPackage({ ...toLocalBill(BILL)!, extraHours: 0 })).toBe(900);
    // Numbers that do not add up: no breakdown at all.
    expect(localBillPackage({ ...toLocalBill(BILL)!, extraHours: 9 })).toBeNull();
  });
});

describe('payment', () => {
  test('pending and paid links are read back', () => {
    expect(
      toPayment({
        status: 'pending',
        amount: 900,
        url: ' https://rzp.io/i/AbC123 ',
        linkId: 'plink_1',
        at: ts('2026-11-20T14:05:00Z'),
      }),
    ).toEqual({
      status: 'pending',
      amount: 900,
      url: 'https://rzp.io/i/AbC123',
      linkId: 'plink_1',
      at: new Date('2026-11-20T14:05:00Z'),
    });
    expect(
      toPayment({
        status: 'paid',
        amount: 900,
        url: 'https://rzp.io/i/AbC123',
        paidAt: ts('2026-11-20T15:00:00Z'),
      }),
    ).toMatchObject({ status: 'paid', paidAt: new Date('2026-11-20T15:00:00Z') });
  });

  test('an unknown status or amount drops it; a bad url is kept but never opened', () => {
    expect(toPayment({ status: 'refunded', amount: 900, url: 'https://rzp.io/i/x' })).toBeUndefined();
    expect(toPayment({ status: 'pending', amount: 0, url: 'https://rzp.io/i/x' })).toBeUndefined();
    expect(toPayment('pending')).toBeUndefined();
    const odd = toPayment({ status: 'pending', amount: 900, url: 42 });
    expect(odd).toEqual({ status: 'pending', amount: 900, url: '' });
    expect(payUrl(odd)).toBeNull();
  });

  test('only Razorpay pages may open', () => {
    for (const ok of [
      'https://rzp.io/i/AbC123',
      'https://rzp.io/rzp/AbC123',
      'https://razorpay.com/payment-link/plink_1',
      'https://rzp.io',
      'HTTPS://RZP.IO/i/x',
      'https://rzp.io/i/x?ref=DB-1042#top',
    ])
      expect(isPaymentUrl(ok)).toBe(true);
    for (const bad of [
      'http://rzp.io/i/x', // not https
      'https://rzp.io.evil.example/i/x',
      'https://rzp.io@evil.example/i/x',
      'https://evil.example/https://rzp.io/i/x',
      'https://pages.razorpay.com.evil.example/',
      'https://notrazorpay.com/x',
      'https://rzp.io:8443/i/x',
      'https://rzp.io/i/x y',
      'https://rzp.io\\@evil.example',
      'javascript:alert(1)',
      `https://rzp.io/${'x'.repeat(500)}`,
      '',
      null,
      42,
    ])
      expect(isPaymentUrl(bad)).toBe(false);
  });

  test('the Pay button opens a link only while the payment is pending', () => {
    const pending = toPayment({ status: 'pending', amount: 900, url: 'https://rzp.io/i/x' });
    expect(payUrl(pending)).toBe('https://rzp.io/i/x');
    expect(payUrl(pending && { ...pending, status: 'paid' })).toBeNull();
    expect(payUrl(undefined)).toBeNull();
  });
});

describe('UPI payments', () => {
  // Exactly what the robot builds (SPEC-upi item 3), with encodeURIComponent.
  const enc = encodeURIComponent;
  const robotLink = (pa = 'drivebuddy@ybl', am = '750.00') =>
    `upi://pay?pa=${enc(pa)}&pn=${enc('DriveBuddy')}&am=${am}&cu=INR&tn=${enc('DB-1042')}`;

  test('the robot’s UPI link is accepted, with method and who confirmed it', () => {
    expect(isUpiPayUrl(robotLink())).toBe(true);
    expect(isPaymentUrl(robotLink())).toBe(true);
    expect(isRazorpayUrl(robotLink())).toBe(false);
    expect(payKind(robotLink())).toBe('upi');
    expect(payKind('https://rzp.io/i/x')).toBe('razorpay');
    for (const ok of [
      'upi://pay?pa=drivebuddy@ybl', // "@" left as it is
      'upi://pay?pa=raju.sahu-1_x%40okaxis&pn=Drive%20Buddy',
      'upi://pay?pn=DriveBuddy&pa=drivebuddy%40ybl&am=750',
      robotLink('9893302783@ybl'),
    ])
      expect(isUpiPayUrl(ok)).toBe(true);
    const p = toPayment({ status: 'pending', method: 'upi', amount: 750, url: robotLink(), by: 'robot' });
    expect(p).toEqual({ status: 'pending', method: 'upi', amount: 750, url: robotLink(), by: 'robot' });
    expect(payUrl(p)).toBe(robotLink());
  });

  test('lookalikes and anything that could pay someone else are refused', () => {
    for (const bad of [
      robotLink().replace('upi://pay?', 'upi://payx?'),
      robotLink().replace('upi://pay?', 'UPI://PAY?'),
      robotLink().replace('upi://pay?', 'upi://pay/?'),
      robotLink().replace('upi://pay?', 'upi:/pay?'),
      robotLink().replace('upi://pay?', 'xupi://pay?'),
      'upi://pay?',
      'upi://pay?pn=DriveBuddy&am=750.00&cu=INR', // no pa
      'upi://pay?pa=&pn=DriveBuddy', // empty pa
      'upi://pay?xpa=drivebuddy@ybl', // not pa
      'upi://pay?pa=drivebuddy', // no @
      'upi://pay?pa=drivebuddy@ybl1', // bank part letters only
      'upi://pay?pa=d@ybl', // too short
      `upi://pay?pa=${'a'.repeat(65)}@ybl`,
      'upi://pay?pa=drive%20buddy@ybl', // a space inside pa
      'upi://pay?pa=drivebuddy@ybl&pa=thief@ybl', // two payees
      'upi://pay?pa=drivebuddy@ybl&pn=Drive Buddy', // a space
      ' upi://pay?pa=drivebuddy@ybl',
      'upi://pay?pa=drivebuddy@ybl\n',
      'upi://pay?pa=drivebuddy@ybl#x',
      'upi://pay?pa=drivebuddy@ybl?pa=thief@ybl',
      'upi://pay?pa=drivebuddy%40ybl%',
      'upi://pay?pa=%E0%A4@ybl', // does not decode
      'upi://pay?pa=drivebuddy@ybl&am=seven',
      'upi://pay?pa=drivebuddy@ybl&am=750&am=1',
      'upi://pay?pa=drivebuddy@ybl&cu=USD',
      `upi://pay?pa=drivebuddy@ybl&tn=${'x'.repeat(480)}`, // over 500
      'upi://mandate?pa=drivebuddy@ybl',
      'intent://pay?pa=drivebuddy@ybl',
      '',
      null,
      42,
    ])
      expect(isUpiPayUrl(bad)).toBe(false);
  });

  test('Pay opens the UPI link only for the amount the button shows', () => {
    const pending = (url: string) => toPayment({ status: 'pending', method: 'upi', amount: 750, url });
    expect(payUrl(pending(robotLink('drivebuddy@ybl', '750.00')))).not.toBeNull();
    expect(payUrl(pending(robotLink('drivebuddy@ybl', '750')))).not.toBeNull();
    expect(payUrl(pending(robotLink('drivebuddy@ybl', '7500.00')))).toBeNull();
    expect(payUrl(pending('upi://pay?pa=drivebuddy@ybl'))).not.toBeNull(); // the customer types it
  });

  test('a payment the driver recorded: paid, by cash or UPI, no link', () => {
    expect(
      toPayment({
        status: 'paid',
        method: 'cash',
        amount: 750,
        by: 'driver',
        paidAt: ts('2026-11-21T10:00:00Z'),
      }),
    ).toEqual({
      status: 'paid',
      method: 'cash',
      amount: 750,
      url: '',
      by: 'driver',
      paidAt: new Date('2026-11-21T10:00:00Z'),
    });
    // An unknown method or an odd "by" is left out, the payment still reads.
    expect(toPayment({ status: 'paid', method: 'cheque', amount: 750, by: 7 })).toEqual({
      status: 'paid',
      amount: 750,
      url: '',
    });
  });
});

describe('the booking carries the new fields', () => {
  test('read when present, absent otherwise', () => {
    const b = toBooking('b1', {
      customerUid: 'uid-1',
      updatedBy: 'robot',
      acceptedPrice: { amount: 5250, at: null },
      localBill: { amount: 300, baseHours: 1, usedHours: 1, extraHours: 0, extraHourRate: 150 },
      payment: { status: 'pending', amount: 300, url: 'https://rzp.io/i/x' },
    });
    expect(b.customerUid).toBe('uid-1');
    expect(b.updatedBy).toBe('robot');
    expect(b.acceptedPrice).toEqual({ amount: 5250 });
    expect(b.localBill?.amount).toBe(300);
    expect(b.payment?.status).toBe('pending');

    const old = toBooking('b2', { acceptedPrice: 'yes', localBill: [], payment: null, customerUid: 7 });
    expect(old.customerUid).toBeUndefined();
    expect(old.acceptedPrice).toBeUndefined();
    expect(old.localBill).toBeUndefined();
    expect(old.payment).toBeUndefined();
  });
});

describe('rating', () => {
  test('exactly the fields the rules accept, with the comment tidied', () => {
    const r = newRatingFields(5, '  Very  good   driver ', 'd1', 'uid-1');
    expect(r).toEqual({ stars: 5, comment: 'Very good driver', driverId: 'd1', customerUid: 'uid-1' });
    for (const key of Object.keys(r ?? {})) expect(RATING_KEYS).toContain(key);
    expect(newRatingFields(3, '', 'd1', 'uid-1')?.comment).toBe('');
  });

  test('anything the rules would refuse is never written', () => {
    expect(newRatingFields(0, '', 'd1', 'u')).toBeNull();
    expect(newRatingFields(6, '', 'd1', 'u')).toBeNull();
    expect(newRatingFields(4.5, '', 'd1', 'u')).toBeNull();
    expect(newRatingFields(4, 'x'.repeat(RATING_COMMENT_MAX + 1), 'd1', 'u')).toBeNull();
    expect(newRatingFields(4, 'x'.repeat(RATING_COMMENT_MAX), 'd1', 'u')).not.toBeNull();
    expect(newRatingFields(4, '', '', 'u')).toBeNull();
    expect(newRatingFields(4, '', 'd1', '')).toBeNull();
  });
});

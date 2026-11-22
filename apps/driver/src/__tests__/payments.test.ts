/**
 * Payments without a gateway (SPEC-upi items 4, 9, 11): the driver's
 * "Payment received" card and its one write, and his earnings less the cash
 * he kept, with the cash-limit warning.
 */

import { DEFAULT_CASH_LIMIT } from '@drivebuddy/shared';

import { fetchCashLimit, loadCashLimit } from '@/data/cashLimit';
import { confirmedForMe, notesForDriver, toJob } from '@/data/jobs';
import { cashOwed, earningsOf, overCashLimit, toOffer } from '@/data/offers';
import { paymentCard, recordPayment, stayAfterDone, toTripTaps } from '@/data/tripTaps';
import { en } from '@/i18n/en';
import { hi } from '@/i18n/hi';

/* A stand-in Firestore: one tripTaps document, and every write the transaction makes. */
const store: { doc: Record<string, unknown> | null; writes: [string, Record<string, unknown>][] } = {
  doc: null,
  writes: [],
};
const SERVER_TIME = { serverTimestamp: true };

jest.mock('@/firebase/app', () => ({ firestore: () => ({}) }));
jest.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...path: string[]) => path.join('/'),
  serverTimestamp: () => SERVER_TIME,
  onSnapshot: jest.fn(),
  runTransaction: async (_db: unknown, fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      get: async () => ({ exists: () => store.doc !== null, data: () => store.doc }),
      update: (ref: string, data: Record<string, unknown>) => store.writes.push([`update ${ref}`, data]),
      set: (ref: string, data: Record<string, unknown>) => store.writes.push([`set ${ref}`, data]),
    }),
}));

const at = (iso: string) => new Date(iso);
const DONE = {
  driverPhone: '9893302783',
  leftAt: at('2026-11-21T04:00:00Z'),
  arrivedAt: at('2026-11-21T04:30:00Z'),
  doneAt: at('2026-11-21T07:40:00Z'),
};

describe('payment received', () => {
  test('nothing before Job done; then collect; then what he recorded — never an amount', () => {
    expect(paymentCard(null)).toEqual({ kind: 'none' });
    expect(paymentCard(undefined)).toEqual({ kind: 'none' });
    expect(paymentCard({ driverPhone: '9893302783', leftAt: DONE.leftAt })).toEqual({ kind: 'none' });
    expect(paymentCard(DONE)).toEqual({ kind: 'collect' });
    expect(paymentCard({ ...DONE, paidBy: 'cash' })).toEqual({ kind: 'recorded', paidBy: 'cash' });
    expect(paymentCard({ ...DONE, paidBy: 'upi' })).toEqual({ kind: 'recorded', paidBy: 'upi' });
  });

  test('the taps document is read safely: paidBy, paidAt — and the customer’s bill is not read at all', () => {
    const ts = (iso: string) => ({ toDate: () => new Date(iso) });
    const t = toTripTaps({
      driverPhone: '9893302783',
      doneAt: ts('2026-11-21T07:40:00Z'),
      amount: 750,
      paidBy: 'upi',
      paidAt: ts('2026-11-21T07:45:00Z'),
    });
    expect(t).toMatchObject({ paidBy: 'upi', paidAt: at('2026-11-21T07:45:00Z') });
    expect(t).not.toHaveProperty('amount');
    expect(paymentCard(t)).toEqual({ kind: 'recorded', paidBy: 'upi' });
    expect(toTripTaps({ driverPhone: 'x', paidBy: 'cheque' }).paidBy).toBeUndefined();
  });

  test('after the robot completes the job, the screen stays for the payment — only on his own Job done', () => {
    expect(stayAfterDone(DONE, '9893302783')).toBe(true);
    expect(stayAfterDone({ ...DONE, paidBy: 'cash' }, '9893302783')).toBe(true);
    expect(stayAfterDone(DONE, '9000000000')).toBe(false);
    expect(stayAfterDone({ driverPhone: '9893302783', leftAt: DONE.leftAt }, '9893302783')).toBe(false);
    expect(stayAfterDone(null, '9893302783')).toBe(false);
    expect(stayAfterDone(undefined, '9893302783')).toBe(false);
  });

  describe('the write', () => {
    const fetchMock = jest.fn(async () => ({ ok: true }));
    beforeEach(() => {
      store.writes = [];
      fetchMock.mockClear();
      global.fetch = fetchMock as unknown as typeof fetch;
    });

    test('exactly { paidBy, paidAt: serverTimestamp() } on tripTaps/{id}, then the robot is pinged', async () => {
      store.doc = { ...DONE };
      await expect(recordPayment('b1', 'cash')).resolves.toEqual({ ok: true, already: false });
      expect(store.writes).toEqual([['update tripTaps/b1', { paidBy: 'cash', paidAt: SERVER_TIME }]]);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    test('once: a second tap (or another phone) changes nothing', async () => {
      store.doc = { ...DONE, paidBy: 'upi' };
      await expect(recordPayment('b1', 'cash')).resolves.toEqual({ ok: true, already: true });
      expect(store.writes).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    test('never before Job done', async () => {
      store.doc = { driverPhone: '9893302783', leftAt: DONE.leftAt };
      await expect(recordPayment('b1', 'upi')).resolves.toEqual({ ok: false, reason: 'order' });
      store.doc = null;
      await expect(recordPayment('b1', 'upi')).resolves.toEqual({ ok: false, reason: 'order' });
      expect(store.writes).toEqual([]);
    });
  });
});

describe('earnings less the cash he kept', () => {
  const o = (id: string, extra: Record<string, unknown> = {}) =>
    toOffer(id, {
      status: 'taken',
      driverPay: 450,
      takenBy: { id: 'd1', name: 'Raju', phone: '9893302783' },
      done: true,
      paid: false,
      ...extra,
    });

  test('cashCollected is read safely', () => {
    expect(o('a', { cashCollected: 750 }).cashCollected).toBe(750);
    for (const odd of [undefined, -5, 7.5, '750', null])
      expect(o('a', { cashCollected: odd }).cashCollected).toBe(0);
  });

  test('net = earned − cash kept, over done and unpaid jobs only (as the weekly payout)', () => {
    const e = earningsOf([
      o('a'),
      o('b', { driverPay: 900, cashCollected: 1200 }),
      o('c', { cashCollected: 300 }),
      o('d', { paid: true, cashCollected: 5000 }), // settled at an earlier payout
      o('e', { done: false, cashCollected: 800 }), // not done yet
      o('f', { status: 'withdrawn', cashCollected: 9000 }),
    ]);
    expect(e.owed).toBe(1800);
    expect(e.cashKept).toBe(1500);
    expect(e.net).toBe(300);
    expect(cashOwed(e)).toBe(0);
  });

  test('more cash than earned: he owes DriveBuddy the difference', () => {
    const e = earningsOf([o('a', { driverPay: 900, cashCollected: 1200 })]);
    expect(e.net).toBe(-300);
    expect(cashOwed(e)).toBe(300);
    expect(cashOwed(earningsOf([o('a', { cashCollected: 450 })]))).toBe(0);
    expect(cashOwed(earningsOf([]))).toBe(0);
  });

  test('over the cash limit only when what he owes is more than the limit', () => {
    expect(overCashLimit({ net: -2001 }, 2000)).toBe(true);
    expect(overCashLimit({ net: -2000 }, 2000)).toBe(false);
    expect(overCashLimit({ net: 5000 }, 2000)).toBe(false);
    expect(overCashLimit({ net: -1 }, 0)).toBe(true);
    expect(overCashLimit({ net: 0 }, 0)).toBe(false);
  });
});

describe('the cash limit from the website', () => {
  const answer = (body: unknown, ok = true) =>
    jest.fn(async () => ({ ok, json: async () => body })) as unknown as typeof fetch;

  test('payments.cashLimit from app-config.json', async () => {
    await expect(fetchCashLimit(answer({ schema: 1, payments: { cashLimit: 2500 } }))).resolves.toBe(2500);
  });

  test('missing, odd, an error page or offline → null', async () => {
    await expect(fetchCashLimit(answer({ schema: 1 }))).resolves.toBeNull();
    await expect(fetchCashLimit(answer({ payments: { cashLimit: 'lots' } }))).resolves.toBeNull();
    await expect(fetchCashLimit(answer({}, false))).resolves.toBeNull();
    const offline = jest.fn(async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    await expect(fetchCashLimit(offline)).resolves.toBeNull();
  });

  test('the built-in 2000 first, then the website’s', async () => {
    const seen: number[] = [];
    loadCashLimit((n) => seen.push(n), answer({ payments: { cashLimit: 3000 } }));
    await new Promise((r) => setTimeout(r, 0));
    expect(seen[seen.length - 1]).toBe(3000);
    expect(DEFAULT_CASH_LIMIT).toBe(2000);
    const offline: number[] = [];
    loadCashLimit((n) => offline.push(n), answer({}, false));
    await new Promise((r) => setTimeout(r, 0));
    // The one saved from the download above, else the built-in one.
    expect([3000, DEFAULT_CASH_LIMIT]).toContain(offline[offline.length - 1]);
  });
});

describe('only his own pay: the customer’s money never reaches a Job', () => {
  test('quote, bill, accepted price, local bill, payment and the trip estimate are left out', () => {
    const job = toJob('b1', {
      name: 'Anita',
      package: 'one-way-drop',
      status: 'assigned',
      trip: {
        to: 'Nagpur',
        destId: 'nagpur',
        kind: 'one-way',
        km: 284,
        days: 1,
        returnHours: 8,
        estFrom: 5600,
        estTo: 5800,
      },
      acceptedPrice: { amount: 5800 },
      localBill: { amount: 900, baseHours: 3, usedHours: 5, extraHours: 2, extraHourRate: 150 },
      payment: { status: 'paid', method: 'cash', amount: 900 },
    });
    for (const k of ['quote', 'bill', 'acceptedPrice', 'localBill', 'payment'])
      expect(job).not.toHaveProperty(k);
    expect(job.trip).toEqual({
      to: 'Nagpur',
      destId: 'nagpur',
      kind: 'one-way',
      km: 284,
      days: 1,
      returnHours: 8,
    });
    expect(JSON.stringify(job)).not.toMatch(/5600|5800|900/);
  });

  test('notes: the trip line loses its estimate, any other rupee figure is masked', () => {
    expect(
      notesForDriver(
        'Trip: Raipur → Delhi · one-way drop · ~1214 km · 2 days + 38 h getting home · est. ₹5,620–5,820\nGate 2',
      ),
    ).toBe('Trip: Raipur → Delhi · one-way drop · ~1214 km · 2 days + 38 h getting home\nGate 2');
    expect(
      notesForDriver('Trip: Raipur → X (not in our list) · one-way drop · 1 day · quote on the call'),
    ).toBe('Trip: Raipur → X (not in our list) · one-way drop · 1 day');
    expect(notesForDriver('Agreed ₹1500, or Rs. 1,600 / INR 1700 / rs 900–1,000')).toBe(
      'Agreed ₹…, or ₹… / ₹… / ₹…',
    );
    // Not money: left alone.
    expect(notesForDriver('Flat 12, 3 hours, 2 bags, hours 4')).toBe('Flat 12, 3 hours, 2 bags, hours 4');
  });

  test('driverConfirmed: read when present, his own only', () => {
    const ts = { toDate: () => new Date('2026-11-21T03:00:00Z') };
    const job = toJob('b1', { driverConfirmed: { at: ts, by: 'robot', driverId: 'd1' } });
    expect(job.driverConfirmed).toEqual({
      at: new Date('2026-11-21T03:00:00Z'),
      by: 'robot',
      driverId: 'd1',
    });
    expect(confirmedForMe(job, 'd1')).toBe(true);
    expect(confirmedForMe(job, 'd2')).toBe(false);
    expect(confirmedForMe(toJob('b1', {}), 'd1')).toBe(false);
    expect(toJob('b1', { driverConfirmed: 'yes' }).driverConfirmed).toBeUndefined();
    expect(confirmedForMe(toJob('b1', { driverConfirmed: { by: 'robot' } }), 'd1')).toBe(true);
  });
});

describe('the new words', () => {
  test('exist in both languages, with the amounts in them', () => {
    for (const t of [en, hi]) {
      expect(t.job.payInfo).toContain('QR');
      expect(t.job.payInfo).not.toMatch(/₹|\d/);
      for (const s of [
        t.job.paidUpi,
        t.job.paidCash,
        t.job.recordedUpi,
        t.job.recordedCash,
        t.job.confirmed,
        t.job.toConfirm,
      ])
        expect(s.length).toBeGreaterThan(5);
      expect(t.offers.accepted).toContain('DriveBuddy');
      expect(t.earnings.cashKept('₹900')).toContain('₹900');
      expect(t.earnings.sumPays('₹1,350', '₹900', '₹450')).toContain('₹450');
      expect(t.earnings.sumOwe('₹900', '₹1,200', '₹300')).toContain('₹300');
      expect(t.earnings.overLimit('₹2,300')).toContain('₹2,300');
      expect(t.earnings.overLimitNote('₹2,000')).toContain('₹2,000');
    }
    expect(en.job.payInfo).toBe(
      "The customer pays DriveBuddy, not you: Pay in the DriveBuddy app, or scan DriveBuddy's QR. If they give you cash, take what their bill says — it comes off your next payout.",
    );
    expect(en.offers.accepted).toBe(
      'The job is yours. It is now in My jobs. DriveBuddy will call you to confirm.',
    );
    expect(en.earnings.sumPays('₹1,350', '₹900', '₹450')).toBe(
      'Earned ₹1,350 · cash you kept ₹900 · DriveBuddy pays you ₹450',
    );
    expect(hi.earnings.overLimit('₹2,300')).toBe('नए काम के लिए DriveBuddy को ₹2,300 जमा करें');
  });
});

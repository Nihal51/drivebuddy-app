/**
 * Payments without a gateway (SPEC-upi items 4, 9, 11): the driver's
 * "Payment received" card and its one write, and his earnings less the cash
 * he kept, with the cash-limit warning.
 */

import { DEFAULT_CASH_LIMIT } from '@drivebuddy/shared';

import { fetchCashLimit, loadCashLimit } from '@/data/cashLimit';
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
  test('nothing before Job done; then collect, with the bill once the robot has it; then what he recorded', () => {
    expect(paymentCard(null)).toEqual({ kind: 'none' });
    expect(paymentCard(undefined)).toEqual({ kind: 'none' });
    expect(paymentCard({ driverPhone: '9893302783', leftAt: DONE.leftAt })).toEqual({ kind: 'none' });
    expect(paymentCard(DONE)).toEqual({ kind: 'collect', amount: null });
    expect(paymentCard({ ...DONE, amount: 750 })).toEqual({ kind: 'collect', amount: 750 });
    expect(paymentCard({ ...DONE, amount: 750, paidBy: 'cash' })).toEqual({
      kind: 'recorded',
      paidBy: 'cash',
      amount: 750,
    });
    expect(paymentCard({ ...DONE, paidBy: 'upi' })).toEqual({
      kind: 'recorded',
      paidBy: 'upi',
      amount: null,
    });
  });

  test('the taps document is read safely: amount, paidBy, paidAt', () => {
    const ts = (iso: string) => ({ toDate: () => new Date(iso) });
    const t = toTripTaps({
      driverPhone: '9893302783',
      doneAt: ts('2026-11-21T07:40:00Z'),
      amount: 750,
      paidBy: 'upi',
      paidAt: ts('2026-11-21T07:45:00Z'),
    });
    expect(t).toMatchObject({ amount: 750, paidBy: 'upi', paidAt: at('2026-11-21T07:45:00Z') });
    const odd = toTripTaps({ driverPhone: 'x', amount: '750', paidBy: 'cheque' });
    expect(odd.amount).toBeUndefined();
    expect(odd.paidBy).toBeUndefined();
    expect(toTripTaps({ amount: 0 }).amount).toBeUndefined();
    expect(toTripTaps({ amount: 750.5 }).amount).toBeUndefined();
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
      store.doc = { ...DONE, amount: 750 };
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

describe('the new words', () => {
  test('exist in both languages, with the amounts in them', () => {
    for (const t of [en, hi]) {
      expect(t.job.collect('₹750')).toContain('₹750');
      expect(t.job.payHint).toContain('QR');
      for (const s of [
        t.job.paidUpi,
        t.job.paidCash,
        t.job.recordedUpi,
        t.job.recordedCash,
        t.job.collectSoon,
      ])
        expect(s.length).toBeGreaterThan(5);
      expect(t.earnings.cashKept('₹900')).toContain('₹900');
      expect(t.earnings.sumPays('₹1,350', '₹900', '₹450')).toContain('₹450');
      expect(t.earnings.sumOwe('₹900', '₹1,200', '₹300')).toContain('₹300');
      expect(t.earnings.overLimit('₹2,300')).toContain('₹2,300');
      expect(t.earnings.overLimitNote('₹2,000')).toContain('₹2,000');
    }
    expect(en.job.collect('₹750')).toBe('Collect ₹750 from the customer');
    expect(en.earnings.sumPays('₹1,350', '₹900', '₹450')).toBe(
      'Earned ₹1,350 · cash you kept ₹900 · DriveBuddy pays you ₹450',
    );
    expect(hi.earnings.overLimit('₹2,300')).toBe('नए काम के लिए DriveBuddy को ₹2,300 जमा करें');
  });
});

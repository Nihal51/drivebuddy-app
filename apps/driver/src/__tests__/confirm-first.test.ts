/**
 * Customer details only after DriveBuddy's call: My jobs asks only for jobs
 * confirmed for him, a taken offer waits on its own, and "Can't make it"
 * works without reading the booking (he cannot read it before the call).
 * Firestore is a stand-in that records what is read and written.
 */

import { myJobsFilters, toJob, watchJobs } from '@/data/jobs';
import { releaseJob, toOffer, waitingOffers } from '@/data/offers';
import { tapTrip } from '@/data/tripTaps';

type Write = [op: string, path: string, data?: Record<string, unknown>];
const fake: { docs: Record<string, Record<string, unknown>>; log: Write[]; wheres: unknown[][] } = {
  docs: {},
  log: [],
  wheres: [],
};
const SERVER_TIME = { serverTimestamp: true };

jest.mock('@/firebase/app', () => ({ firestore: () => ({}) }));
jest.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...path: string[]) => path.join('/'),
  collection: (_db: unknown, name: string) => name,
  where: (...args: unknown[]) => {
    fake.wheres.push(args);
    return args;
  },
  query: (...parts: unknown[]) => parts,
  onSnapshot: jest.fn(() => () => {}),
  serverTimestamp: () => SERVER_TIME,
  runTransaction: async (_db: unknown, fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      get: async (path: string) => {
        fake.log.push(['get', path]);
        const data = fake.docs[path];
        return { id: path.split('/')[1], exists: () => data !== undefined, data: () => data };
      },
      update: (path: string, data: Record<string, unknown>) => fake.log.push(['update', path, data]),
    }),
}));

const ME = { phone: '9893302783', uid: 'u1' };
const TAKEN = { status: 'taken', takenBy: { id: 'd1', name: 'Raju', phone: ME.phone }, city: 'Raipur' };

beforeEach(() => {
  fake.docs = {};
  fake.log = [];
  fake.wheres = [];
  global.fetch = jest.fn(async () => ({ ok: true })) as unknown as typeof fetch;
});

describe('My jobs', () => {
  test('only bookings assigned to him, still assigned, and confirmed for his driver id', () => {
    expect(myJobsFilters(ME.phone, 'd1')).toEqual([
      ['assignedDriver.phone', '==', ME.phone],
      ['status', '==', 'assigned'],
      ['driverConfirmed.driverId', '==', 'd1'],
    ]);
    watchJobs(ME.phone, 'd1', () => {});
    expect(fake.wheres).toEqual([
      ['assignedDriver.phone', '==', ME.phone],
      ['status', '==', 'assigned'],
      ['driverConfirmed.driverId', '==', 'd1'],
    ]);
  });
});

describe('waiting for confirmation', () => {
  const o = (id: string, extra: Record<string, unknown> = {}) => toOffer(id, { ...TAKEN, ...extra });

  test('his taken, not-done offers without a confirmed job, soonest first', () => {
    const list = [
      o('late', { when: '2026-11-25T18:00' }),
      o('soon', { when: '2026-11-25T09:00' }),
      o('confirmed'),
      o('done', { done: true }),
      o('released', { status: 'released' }),
      o('other', { takenBy: { id: 'd2', name: 'Shyam', phone: '9111473929' } }),
    ];
    expect(waitingOffers(list, ['confirmed'], ME.phone).map((x) => x.id)).toEqual(['soon', 'late']);
  });
});

describe("can't make it, without reading the booking", () => {
  test('reads only the offer; writes the offer and the booking', async () => {
    fake.docs['offers/b1'] = TAKEN;
    await expect(releaseJob('b1', ME, false)).resolves.toEqual({ ok: true });
    expect(fake.log.filter(([op]) => op === 'get').map(([, path]) => path)).toEqual(['offers/b1']);
    expect(fake.log.filter(([op]) => op === 'update')).toEqual([
      ['update', 'offers/b1', { status: 'released', updatedAt: SERVER_TIME }],
      [
        'update',
        'bookings/b1',
        { status: 'confirmed', assignedDriver: null, updatedAt: SERVER_TIME, updatedBy: 'u1' },
      ],
    ]);
    expect(global.fetch).toHaveBeenCalledTimes(1); // the robot re-offers it now
  });

  test('not his offer, or already started: nothing is written', async () => {
    fake.docs['offers/b1'] = { ...TAKEN, takenBy: { id: 'd2', name: 'Shyam', phone: '9111473929' } };
    await expect(releaseJob('b1', ME, false)).resolves.toEqual({ ok: false, reason: 'not-from-offer' });
    delete fake.docs['offers/b1'];
    await expect(releaseJob('b1', ME, false)).resolves.toEqual({ ok: false, reason: 'not-from-offer' });
    fake.docs['offers/b1'] = TAKEN;
    await expect(releaseJob('b1', ME, true)).resolves.toEqual({ ok: false, reason: 'started' });
    expect(fake.log.filter(([op]) => op === 'update')).toEqual([]);
    expect(fake.log.some(([, path]) => path.startsWith('bookings/'))).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('after a one-way drop: Boarded the train, or home by bus', () => {
  const TAPS = {
    driverPhone: ME.phone,
    leftAt: new Date('2026-11-24T01:30:00Z'),
    arrivedAt: new Date('2026-11-24T02:00:00Z'),
    doneAt: new Date('2026-11-24T14:00:00Z'),
  };

  test('exactly { boardAt: serverTimestamp() } on his taps, after the drop', async () => {
    fake.docs['tripTaps/b1'] = TAPS;
    await expect(tapTrip('b1', 'boardAt', 'one-way-drop', ME.phone)).resolves.toEqual({
      ok: true,
      already: false,
    });
    expect(fake.log.filter(([op]) => op === 'update')).toEqual([
      ['update', 'tripTaps/b1', { boardAt: SERVER_TIME }],
    ]);
  });

  test('home by bus straight after the drop; never Boarded on a local job or before the drop', async () => {
    fake.docs['tripTaps/b1'] = TAPS;
    await expect(tapTrip('b1', 'homeAt', 'one-way-drop', ME.phone)).resolves.toEqual({
      ok: true,
      already: false,
    });
    expect(fake.log.filter(([op]) => op === 'update')).toEqual([
      ['update', 'tripTaps/b1', { homeAt: SERVER_TIME }],
    ]);
    fake.log = [];
    await expect(tapTrip('b1', 'boardAt', '3-hours-600', ME.phone)).resolves.toEqual({
      ok: false,
      reason: 'order',
    });
    fake.docs['tripTaps/b1'] = { ...TAPS, doneAt: undefined };
    await expect(tapTrip('b1', 'boardAt', 'one-way-drop', ME.phone)).resolves.toEqual({
      ok: false,
      reason: 'order',
    });
    expect(fake.log.filter(([op]) => op === 'update')).toEqual([]);
  });
});

describe('the trains home, as the driver sees them', () => {
  test('the options and the chosen train — never the price with each, nor the final price', () => {
    const ts = (iso: string) => ({ toDate: () => new Date(iso) });
    const job = toJob('b1', {
      package: 'one-way-drop',
      status: 'assigned',
      returnCheck: {
        at: ts('2026-11-24T14:05:00Z'),
        options: [
          {
            train: '18452',
            name: 'Tapaswini Exp',
            from: 'RNC',
            dep: ts('2026-11-24T16:10:00Z'),
            change: null,
            waitMin: 130,
            waitCharge: 0,
            price: 2650,
          },
          {
            train: '12873',
            name: 'Jharkhand Exp',
            from: 'HTE',
            dep: ts('2026-11-25T03:00:00Z'),
            change: null,
            waitMin: 780,
            waitCharge: 900,
            price: 3550,
          },
        ],
        bus: false,
        failed: false,
      },
      returnChoice: { train: '18452', dep: ts('2026-11-24T16:10:00Z'), at: ts('2026-11-24T14:20:00Z') },
      returnPrice: { price: 2650, waitCharge: 0, train: '18452', at: ts('2026-11-24T14:21:00Z') },
    });
    expect(job.returnCheck?.options.map((o) => o.train)).toEqual(['18452', '12873']);
    expect(job.returnChoice?.train).toBe('18452');
    expect(job).not.toHaveProperty('returnPrice');
    expect(JSON.stringify(job)).not.toMatch(/2650|3550|price|waitCharge/);
  });
});

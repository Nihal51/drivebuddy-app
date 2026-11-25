/**
 * Customer details only after DriveBuddy's call: My jobs asks only for jobs
 * confirmed for him, a taken offer waits on its own, and "Can't make it"
 * works without reading the booking (he cannot read it before the call).
 * He is known by his driver id, his number only on bookings from before
 * (SPEC-privacy). Firestore is a stand-in that records what is read and written.
 */

import { type Job, mergeJobs, myJobsQueries, toJob, watchJobs } from '@/data/jobs';
import { acceptOffer, releaseJob, toOffer, waitingOffers, watchMyOffers } from '@/data/offers';
import { tapTrip } from '@/data/tripTaps';

type Write = [op: string, path: string, data?: Record<string, unknown>];
const fake: {
  docs: Record<string, Record<string, unknown>>;
  log: Write[];
  wheres: unknown[][];
  snapshots: unknown[][];
} = {
  docs: {},
  log: [],
  wheres: [],
  snapshots: [],
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
  onSnapshot: (...args: unknown[]) => {
    fake.snapshots.push(args);
    return () => {};
  },
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

const ME = { driverId: 'd1', phone: '9893302783', uid: 'u1' };
const TAKEN = { status: 'taken', takenBy: { id: 'd1', name: 'Raju', phone: ME.phone }, city: 'Raipur' };

beforeEach(() => {
  fake.docs = {};
  fake.log = [];
  fake.wheres = [];
  fake.snapshots = [];
  global.fetch = jest.fn(async () => ({ ok: true })) as unknown as typeof fetch;
});

describe('My jobs', () => {
  const confirmed = [
    ['status', '==', 'assigned'],
    ['driverConfirmed.driverId', '==', 'd1'],
  ];

  test('bookings assigned to his driver id (or, from before, his number), still assigned, confirmed for him', () => {
    expect(myJobsQueries(ME.phone, 'd1')).toEqual({
      byId: [['assignedDriver.id', '==', 'd1'], ...confirmed],
      byPhone: [['assignedDriver.phone', '==', ME.phone], ...confirmed],
    });
    watchJobs(ME.phone, 'd1', () => {});
    expect(fake.wheres).toEqual([
      ['assignedDriver.id', '==', 'd1'],
      ...confirmed,
      ['assignedDriver.phone', '==', ME.phone],
      ...confirmed,
    ]);
  });

  const job = (id: string, driver: Record<string, unknown>, extra: Record<string, unknown> = {}): Job =>
    toJob(id, {
      status: 'assigned',
      package: '3-hours-600',
      assignedDriver: driver,
      driverConfirmed: { by: 'robot', driverId: 'd1' },
      ...extra,
    });

  test('by number only the bookings without an id; each once; null only when neither list can be read', () => {
    const mine = job('a', { id: 'd1', name: 'Raju' });
    const old = job('b', { name: 'Raju', phone: ME.phone });
    const both = job('c', { id: 'd1', name: 'Raju', phone: ME.phone });
    const someoneElse = job('d', { id: 'd2', name: 'Shyam', phone: ME.phone });
    expect(
      mergeJobs([mine, both], [old, both, someoneElse], 'd1')
        ?.map((j) => j.id)
        .sort(),
    ).toEqual(['a', 'b', 'c']);
    // Once the rules no longer take his number, that query is refused: the jobs by id still show.
    expect(mergeJobs([mine], null, 'd1')?.map((j) => j.id)).toEqual(['a']);
    expect(mergeJobs(null, [old], 'd1')?.map((j) => j.id)).toEqual(['b']);
    expect(mergeJobs(null, null, 'd1')).toBeNull();
  });

  test('told once both lists have answered; a refused list does not hide the other', () => {
    const seen: (Job[] | null)[] = [];
    watchJobs(ME.phone, 'd1', (jobs) => seen.push(jobs));
    type Snap = { docs: { id: string; data: () => Record<string, unknown> }[] };
    const [byId, byPhone] = fake.snapshots as [unknown, (s: Snap) => void, (e: unknown) => void][];
    byId?.[1]({
      docs: [
        {
          id: 'a',
          data: () => ({
            status: 'assigned',
            assignedDriver: { id: 'd1', name: 'Raju' },
            driverConfirmed: { driverId: 'd1' },
          }),
        },
      ],
    });
    expect(seen).toEqual([]);
    byPhone?.[2](new Error('permission-denied'));
    expect(seen.map((l) => l?.map((j) => j.id))).toEqual([['a']]);
  });

  test('a job never carries the customer’s Change driver, nor who drove it before', () => {
    const j = job(
      'a',
      { id: 'd1', name: 'Raju' },
      {
        driverChangeRequest: { at: null, reason: 'He was rude' },
        changedDrivers: ['d9'],
        driverChanges: 1,
      },
    );
    expect(JSON.stringify(j)).not.toMatch(/rude|d9|driverChangeRequest|changedDrivers/);
  });
});

describe('taking an offer', () => {
  test('he is written on the offer and the booking by id and name — never his number', async () => {
    fake.docs['offers/b1'] = { status: 'open', city: 'Raipur' };
    await expect(acceptOffer('b1', { driverId: 'd1', name: 'Raju Sahu', uid: 'u1' })).resolves.toEqual({
      ok: true,
    });
    const updates = fake.log.filter(([op]) => op === 'update');
    expect(updates).toEqual([
      [
        'update',
        'offers/b1',
        {
          status: 'taken',
          takenBy: { id: 'd1', name: 'Raju Sahu' },
          takenAt: SERVER_TIME,
          updatedAt: SERVER_TIME,
        },
      ],
      [
        'update',
        'bookings/b1',
        {
          status: 'assigned',
          assignedDriver: { id: 'd1', name: 'Raju Sahu' },
          updatedAt: SERVER_TIME,
          updatedBy: 'u1',
        },
      ],
    ]);
    expect(JSON.stringify(updates)).not.toContain(ME.phone);
  });

  test('his taken offers are asked for by his driver id', () => {
    watchMyOffers('d1', () => {});
    expect(fake.wheres).toEqual([['takenBy.id', '==', 'd1']]);
    const none = jest.fn();
    watchMyOffers('', none);
    expect(none).toHaveBeenCalledWith(null);
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
      o('by-id', { when: '2026-11-25T12:00', takenBy: { id: 'd1', name: 'Raju' } }),
    ];
    expect(waitingOffers(list, ['confirmed'], ME).map((x) => x.id)).toEqual(['soon', 'by-id', 'late']);
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

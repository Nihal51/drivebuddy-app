import { cleanUpi, isUpi, toMyRecord } from '@/data/me';
import { earningsOf, mergeOffers, releaseCheck, toOffer } from '@/data/offers';
import { jobButtons, nextTap, tapCheck, tapSteps, tapTimes, toTripTaps } from '@/data/tripTaps';
import { failureOf, within } from '@/data/write';

const at = (iso: string) => new Date(iso);

describe('trip taps', () => {
  const left = { driverPhone: '9893302783', leftAt: at('2026-11-20T04:00:00Z') };
  const arrived = { ...left, arrivedAt: at('2026-11-20T04:30:00Z') };
  const done = { ...arrived, doneAt: at('2026-11-20T07:40:00Z') };

  test('the buttons come in order: Start, Arrived, Job done (and Boarded, Reached home after a one-way drop)', () => {
    expect(tapSteps('3-hours-600')).toEqual(['leftAt', 'arrivedAt', 'doneAt']);
    expect(tapSteps('one-way-drop')).toEqual(['leftAt', 'arrivedAt', 'doneAt', 'boardAt', 'homeAt']);
    expect(nextTap(null, '3-hours-600')).toBe('leftAt');
    expect(nextTap(left, '3-hours-600')).toBe('arrivedAt');
    expect(nextTap(arrived, 'outstation')).toBe('doneAt');
    expect(nextTap(done, 'outstation')).toBeNull();
    expect(nextTap(done, 'one-way-drop')).toBe('boardAt');
    expect(nextTap({ ...done, boardAt: at('2026-11-20T09:00:00Z') }, 'one-way-drop')).toBe('homeAt');
    expect(nextTap({ ...done, homeAt: at('2026-11-20T12:00:00Z') }, 'one-way-drop')).toBeNull();
    expect(nextTap(null, null)).toBe('leftAt');
  });

  test('an odd document never asks for a time before one already saved', () => {
    expect(nextTap({ driverPhone: '', doneAt: at('2026-11-20T07:40:00Z') }, '1-hour-300')).toBeNull();
    expect(nextTap({ driverPhone: '', arrivedAt: at('2026-11-20T04:30:00Z') }, '1-hour-300')).toBe('doneAt');
  });

  test('each tap is saved once, in order', () => {
    expect(tapCheck(null, 'leftAt', '3-hours-600')).toBe('ok');
    expect(tapCheck(left, 'leftAt', '3-hours-600')).toBe('already');
    expect(tapCheck(left, 'arrivedAt', '3-hours-600')).toBe('ok');
    expect(tapCheck(left, 'doneAt', '3-hours-600')).toBe('order');
    expect(tapCheck(null, 'arrivedAt', '3-hours-600')).toBe('order');
    expect(tapCheck(done, 'homeAt', '3-hours-600')).toBe('order'); // only one-way drops
    expect(tapCheck(done, 'homeAt', 'one-way-drop')).toBe('ok'); // home by bus, without boarding
    expect(tapCheck(done, 'boardAt', 'one-way-drop')).toBe('ok');
    expect(tapCheck(done, 'boardAt', 'outstation')).toBe('order'); // one-way drops only
    expect(tapCheck(arrived, 'boardAt', 'one-way-drop')).toBe('order'); // after the drop
    const home = { ...done, homeAt: at('2026-11-20T12:00:00Z') };
    expect(tapCheck(home, 'boardAt', 'one-way-drop')).toBe('order'); // not after home
    expect(tapCheck({ ...done, boardAt: at('2026-11-20T09:00:00Z') }, 'boardAt', 'one-way-drop')).toBe(
      'already',
    );
  });

  test('the job screen: share again after a restart, stop sharing when it should be off', () => {
    expect(jobButtons(null, '3-hours-600', false)).toEqual({
      tap: 'leftAt',
      shareAgain: false,
      stopSharing: false,
      homeByBus: false,
    });
    // On his way and sharing: just Arrived.
    expect(jobButtons(left, '3-hours-600', true)).toEqual({
      tap: 'arrivedAt',
      shareAgain: false,
      stopSharing: false,
      homeByBus: false,
    });
    // On his way, but the phone restarted (sharing off): offer to share again.
    expect(jobButtons(left, '3-hours-600', false).shareAgain).toBe(true);
    // Sharing without a saved Start (the tap was refused), or after Arrived: he can stop it.
    expect(jobButtons(null, '3-hours-600', true)).toMatchObject({ tap: 'leftAt', stopSharing: true });
    expect(jobButtons(arrived, '3-hours-600', true)).toMatchObject({ tap: 'doneAt', stopSharing: true });
    expect(jobButtons(done, 'outstation', false)).toEqual({
      tap: null,
      shareAgain: false,
      stopSharing: false,
      homeByBus: false,
    });
    // After a one-way drop: Boarded the train, or home by bus.
    expect(jobButtons(done, 'one-way-drop', false)).toMatchObject({ tap: 'boardAt', homeByBus: true });
  });

  test('saved times are listed in order; a stored document is read safely', () => {
    expect(tapTimes(done, 'outstation').map((x) => x.step)).toEqual(['leftAt', 'arrivedAt', 'doneAt']);
    expect(tapTimes(null, 'outstation')).toEqual([]);
    const read = toTripTaps({
      driverPhone: '9893302783',
      leftAt: { toDate: () => at('2026-11-20T04:00:00Z') },
      arrivedAt: null,
      doneAt: 'yesterday',
    });
    expect(read).toEqual({
      driverPhone: '9893302783',
      leftAt: at('2026-11-20T04:00:00Z'),
      arrivedAt: undefined,
      doneAt: undefined,
      homeAt: undefined,
    });
    expect(toTripTaps({}).driverPhone).toBe('');
  });
});

describe("can't make it", () => {
  const me = { driverId: 'd1', phone: '9893302783' };
  const offer = (extra: Record<string, unknown> = {}) =>
    toOffer('b1', {
      status: 'taken',
      takenBy: { id: 'd1', name: 'Raju', phone: me.phone },
      city: 'Raipur',
      ...extra,
    });
  test('only a job he took from an offer, before Start — decided from the offer alone', () => {
    expect(releaseCheck(offer(), false, me)).toBe('ok');
    expect(releaseCheck(offer(), true, me)).toBe('started');
    expect(releaseCheck(null, false, me)).toBe('not-from-offer'); // the office assigned it
    expect(
      releaseCheck(offer({ takenBy: { id: 'd2', name: 'Shyam', phone: '9111473929' } }), false, me),
    ).toBe('not-from-offer');
    expect(releaseCheck(offer({ status: 'released' }), false, me)).toBe('not-from-offer');
    expect(releaseCheck(offer({ status: 'withdrawn' }), false, me)).toBe('not-from-offer');
  });

  test('his by driver id (offers taken from 25 Nov 2026 carry no number); by number only without an id', () => {
    expect(releaseCheck(offer({ takenBy: { id: 'd1', name: 'Raju' } }), false, me)).toBe('ok');
    // Another driver's id wins over a number that happens to match.
    expect(releaseCheck(offer({ takenBy: { id: 'd2', name: 'Shyam', phone: me.phone } }), false, me)).toBe(
      'not-from-offer',
    );
    expect(releaseCheck(offer({ takenBy: { name: 'Raju', phone: me.phone } }), false, me)).toBe('ok');
    expect(
      releaseCheck(offer({ takenBy: { name: 'Raju', phone: me.phone } }), false, {
        driverId: 'd1',
        phone: '',
      }),
    ).toBe('not-from-offer');
  });

  test('a released offer is read as released and left out of his earnings', () => {
    const released = offer({ status: 'released', driverPay: 450, done: false });
    expect(released.status).toBe('released');
    expect(released.takenId).toBe('d1');
    const e = earningsOf([released, offer({ driverPay: 300 })]);
    expect(e.list).toHaveLength(1);
    expect(e.upcoming).toBe(300);
  });
});

describe('offers for nearby cities', () => {
  const o = (id: string, extra: Record<string, unknown> = {}) =>
    toOffer(id, { status: 'open', city: 'Raipur', when: '', ...extra });

  test('cities: as stored, or its own city for an older offer', () => {
    expect(o('a', { cities: ['Bhilai', 'Durg', 'Raipur', 7] }).cities).toEqual(['Bhilai', 'Durg', 'Raipur']);
    expect(o('b').cities).toEqual(['Raipur']);
    expect(o('c', { cities: [] }).cities).toEqual(['Raipur']);
    expect(toOffer('d', {}).cities).toEqual([]);
  });

  test('the new and the old query are merged: each offer once, soonest first', () => {
    const merged = mergeOffers([
      [o('x', { when: '2026-11-20T18:00', cities: ['Raipur'] }), o('y', { when: '2026-11-20T09:00' })],
      [o('x', { when: '2026-11-20T18:00' }), o('z', { when: '2026-11-20T12:00' })],
    ]);
    expect(merged?.map((x) => x.id)).toEqual(['y', 'z', 'x']);
  });

  test('one query refused or still loading does not hide the other; only both refused is an error', () => {
    expect(mergeOffers([null, [o('a')]])?.map((x) => x.id)).toEqual(['a']);
    expect(mergeOffers([undefined, [o('a')]])?.map((x) => x.id)).toEqual(['a']);
    expect(mergeOffers([undefined, undefined])).toEqual([]);
    expect(mergeOffers([null, null])).toBeNull();
  });

  test('an offer that is no longer open drops out', () => {
    expect(mergeOffers([[o('a', { status: 'taken' }), o('b')], []])?.map((x) => x.id)).toEqual(['b']);
  });
});

describe('his record: UPI ID, rating, strikes', () => {
  test('UPI IDs: the pattern the rules check', () => {
    for (const ok of ['raju@okaxis', 'raju.sahu-1_x@ybl', '9893302783@paytm', 'RS@SBI'])
      expect(isUpi(ok)).toBe(true);
    for (const bad of ['raju', '@okaxis', 'r@okaxis', 'raju@ok1', 'raju@o', 'ra ju@okaxis', 'raju@@ybl', ''])
      expect(isUpi(bad)).toBe(false);
    expect(isUpi(`${'a'.repeat(65)}@ybl`)).toBe(false);
    expect(cleanUpi(' raju @okaxis ')).toBe('raju@okaxis');
  });

  test('rating and strikes are read safely, and only when there are ratings', () => {
    expect(toMyRecord({ name: 'Raju', city: 'Raipur', status: 'active' })).toEqual({
      name: 'Raju',
      city: 'Raipur',
      status: 'active',
      upi: '',
      ratingCount: 0,
      strikes: 0,
    });
    expect(toMyRecord({ ratingAvg: 4.6, ratingCount: 12, strikes: 2, upi: 'raju@ybl' })).toMatchObject({
      ratingAvg: 4.6,
      ratingCount: 12,
      strikes: 2,
      upi: 'raju@ybl',
    });
    expect(toMyRecord({ ratingAvg: 4.6, ratingCount: 0 })).not.toHaveProperty('ratingAvg');
    expect(toMyRecord({ ratingAvg: 9, ratingCount: 3, strikes: -1 })).toMatchObject({
      ratingCount: 3,
      strikes: 0,
    });
    expect(toMyRecord({ ratingAvg: 9, ratingCount: 3 })).not.toHaveProperty('ratingAvg');
  });
});

describe('writes', () => {
  test('errors → what the driver can do', () => {
    expect(failureOf({ code: 'permission-denied' })).toBe('refused');
    expect(failureOf({ code: 'unavailable' })).toBe('network');
    expect(failureOf(new Error('timeout'))).toBe('network');
    expect(failureOf(new Error('boom'))).toBe('failed');
    expect(failureOf(null)).toBe('failed');
  });

  test('a write that hangs gives up after the limit', async () => {
    jest.useFakeTimers();
    const hanging = within(new Promise(() => {}), 1000);
    jest.advanceTimersByTime(1000);
    await expect(hanging).rejects.toThrow('timeout');
    jest.useRealTimers();
    await expect(within(Promise.resolve(5), 1000)).resolves.toBe(5);
  });
});

describe('the new words', () => {
  test('exist in both languages', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { en } = require('@/i18n/en') as typeof import('@/i18n/en');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { hi } = require('@/i18n/hi') as typeof import('@/i18n/hi');
    for (const t of [en, hi]) {
      for (const step of tapSteps('one-way-drop')) expect(t.job.taps[step].length).toBeGreaterThan(2);
      expect(t.job.cantMakeBody.length).toBeGreaterThan(20);
      expect(t.earnings.upiSavedAs('raju@okaxis')).toContain('raju@okaxis');
      expect(t.earnings.rating('4.6', 12)).toContain('4.6');
      expect(t.earnings.strikes(2)).toContain('2');
    }
    expect(en.earnings.rating('5.0', 1)).toBe('5.0 ★ from 1 rating');
  });
});

import { toBooking } from '@drivebuddy/shared';

import { cleanUpi, isUpi, toMyRecord } from '@/data/me';
import { earningsOf, mergeOffers, releaseCheck, toOffer } from '@/data/offers';
import { nextTap, tapCheck, tapSteps, tapTimes, toTripTaps } from '@/data/tripTaps';
import { failureOf, within } from '@/data/write';

const at = (iso: string) => new Date(iso);

describe('trip taps', () => {
  const left = { driverPhone: '9893302783', leftAt: at('2026-11-20T04:00:00Z') };
  const arrived = { ...left, arrivedAt: at('2026-11-20T04:30:00Z') };
  const done = { ...arrived, doneAt: at('2026-11-20T07:40:00Z') };

  test('the buttons come in order: Start, Arrived, Job done (and Reached home after a one-way drop)', () => {
    expect(tapSteps('3-hours-600')).toEqual(['leftAt', 'arrivedAt', 'doneAt']);
    expect(tapSteps('one-way-drop')).toEqual(['leftAt', 'arrivedAt', 'doneAt', 'homeAt']);
    expect(nextTap(null, '3-hours-600')).toBe('leftAt');
    expect(nextTap(left, '3-hours-600')).toBe('arrivedAt');
    expect(nextTap(arrived, 'outstation')).toBe('doneAt');
    expect(nextTap(done, 'outstation')).toBeNull();
    expect(nextTap(done, 'one-way-drop')).toBe('homeAt');
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
    expect(tapCheck(done, 'homeAt', 'one-way-drop')).toBe('ok');
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
  const me = '9893302783';
  const offer = (extra: Record<string, unknown> = {}) =>
    toOffer('b1', {
      status: 'taken',
      takenBy: { id: 'd1', name: 'Raju', phone: me },
      city: 'Raipur',
      ...extra,
    });
  const booking = (extra: Record<string, unknown> = {}) =>
    toBooking('b1', {
      status: 'assigned',
      assignedDriver: { id: 'd1', name: 'Raju', phone: me },
      ...extra,
    });

  test('only a job he took from an offer, still his, before Start', () => {
    expect(releaseCheck(offer(), booking(), false, me)).toBe('ok');
    expect(releaseCheck(offer(), booking(), true, me)).toBe('started');
    expect(releaseCheck(null, booking(), false, me)).toBe('not-from-offer'); // the office assigned it
    expect(
      releaseCheck(
        offer({ takenBy: { id: 'd2', name: 'Shyam', phone: '9111473929' } }),
        booking(),
        false,
        me,
      ),
    ).toBe('not-from-offer');
    expect(releaseCheck(offer({ status: 'released' }), booking(), false, me)).toBe('not-from-offer');
    expect(releaseCheck(offer(), booking({ status: 'completed' }), false, me)).toBe('not-his');
    expect(
      releaseCheck(
        offer(),
        booking({ assignedDriver: { id: 'd2', name: 'Shyam', phone: '9111473929' } }),
        false,
        me,
      ),
    ).toBe('not-his');
    expect(releaseCheck(offer(), null, false, me)).toBe('not-his');
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

import { toBooking } from './booking';
import {
  finalTrainPrice,
  isTrainNumber,
  returnChoiceFields,
  toReturnCheck,
  toReturnChoice,
  toReturnPrice,
} from './returnTrains';
import { toClock } from './trip';

const ts = (iso: string) => ({ toDate: () => new Date(iso) });
const CHECK = {
  at: ts('2026-11-24T14:05:00Z'),
  dropAt: ts('2026-11-24T14:00:00Z'),
  options: [
    {
      train: '18452',
      name: 'Tapaswini Exp',
      from: 'RNC',
      dep: ts('2026-11-24T16:10:00Z'),
      arr: ts('2026-11-25T01:40:00Z'),
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
      arr: ts('2026-11-25T14:00:00Z'),
      change: { station: 'JSG', train: '18109', dep: ts('2026-11-25T09:00:00Z') },
      waitMin: 780,
      waitCharge: 900,
      price: 3550,
    },
  ],
  bus: false,
  failed: false,
};

describe('the train check at the drop', () => {
  test('read back whole; odd options left out; absent → none', () => {
    const c = toReturnCheck({ ...CHECK, options: [...CHECK.options, { name: 'no number' }, 'x'] });
    expect(c?.options.map((o) => o.train)).toEqual(['18452', '12873']);
    expect(c?.options[0]).toMatchObject({ dep: new Date('2026-11-24T16:10:00Z'), price: 2650, change: null });
    expect(c?.options[1]?.change).toEqual({
      station: 'JSG',
      train: '18109',
      dep: new Date('2026-11-25T09:00:00Z'),
    });
    expect(toReturnCheck({ bus: true })).toEqual({
      at: undefined,
      dropAt: undefined,
      options: [],
      bus: true,
      failed: false,
    });
    expect(toReturnCheck(null)).toBeUndefined();
    expect(toReturnChoice({ train: '18452', dep: ts('2026-11-24T16:10:00Z') })?.train).toBe('18452');
    expect(toReturnChoice({ dep: 1 })).toBeUndefined();
    expect(toReturnPrice({ price: 2650, train: '18452' })).toEqual({
      price: 2650,
      waitCharge: 0,
      train: '18452',
      at: undefined,
    });
    expect(toReturnPrice({ price: '2650', train: '18452' })).toBeUndefined();
  });

  test('on the booking, and boardAt on its clock', () => {
    const b = toBooking('b1', {
      status: 'assigned',
      returnCheck: CHECK,
      returnChoice: { train: '18452', dep: ts('2026-11-24T16:10:00Z'), at: ts('2026-11-24T14:20:00Z') },
      returnPrice: { price: 2650, waitCharge: 0, train: '18452', at: ts('2026-11-24T14:21:00Z') },
    });
    expect(b.returnCheck?.options).toHaveLength(2);
    expect(finalTrainPrice(b)).toBe(2650);
    expect(
      finalTrainPrice({ ...b, returnPrice: { price: 3550, waitCharge: 900, train: '12873' } }),
    ).toBeNull();
    expect(toBooking('b2', {}).returnCheck).toBeUndefined();
    expect(
      toClock({ startAt: ts('2026-11-24T01:30:00Z'), boardAt: ts('2026-11-24T16:12:00Z') })?.boardAt,
    ).toEqual(new Date('2026-11-24T16:12:00Z'));
  });
});

describe('"I booked this train" — what the rules allow', () => {
  const booking = (extra: Record<string, unknown> = {}) =>
    toBooking('b1', { status: 'assigned', returnCheck: CHECK, ...extra });

  test('one of the offered trains, with its departure', () => {
    expect(returnChoiceFields(booking(), '12873')).toEqual({
      ok: true,
      train: '12873',
      dep: new Date('2026-11-25T03:00:00Z'),
    });
  });

  test('not before the check, not twice, not a train it did not offer, not once the booking is closed', () => {
    expect(returnChoiceFields(toBooking('b1', { status: 'assigned' }), '18452')).toEqual({
      ok: false,
      reason: 'no-check',
    });
    expect(
      returnChoiceFields(
        booking({ returnChoice: { train: '18452', dep: ts('2026-11-24T16:10:00Z') } }),
        '12873',
      ),
    ).toEqual({ ok: false, reason: 'chosen' });
    expect(returnChoiceFields(booking(), '99999')).toEqual({ ok: false, reason: 'not-offered' });
    expect(returnChoiceFields(booking({ status: 'completed' }), '18452')).toEqual({
      ok: false,
      reason: 'closed',
    });
    expect(returnChoiceFields(booking({ status: 'cancelled' }), '18452')).toEqual({
      ok: false,
      reason: 'closed',
    });
  });

  test('train numbers as the rules check them', () => {
    expect(isTrainNumber('18452')).toBe(true);
    expect(isTrainNumber('1845')).toBe(true);
    expect(isTrainNumber('184521')).toBe(false);
    expect(isTrainNumber('1845a')).toBe(false);
  });
});

import { toBooking } from './booking';
import {
  CHANGE_REASON_MAX,
  DRIVER_CHANGES_MAX,
  changeReason,
  driverChangesLeft,
  initialsOf,
  toAlertResult,
  toAlertTest,
  toDriverCard,
  toDriverChangeRequest,
  toDriverConfirmed,
  toDriverRef,
} from './driver';

const ts = (iso: string) => ({ toDate: () => new Date(iso) });

describe('the driver on a booking', () => {
  test('by id and name — an older booking’s number is never read', () => {
    expect(toDriverRef({ id: 'd1', name: 'Raju Sahu', phone: '9893302783' })).toEqual({
      id: 'd1',
      name: 'Raju Sahu',
    });
    expect(toDriverRef({ id: 'd1', name: 'Raju Sahu' })).toEqual({ id: 'd1', name: 'Raju Sahu' });
    // Very old ones without an id still name him.
    expect(toDriverRef({ name: 'Raju', phone: '9893302783' })).toEqual({ id: '', name: 'Raju' });
    expect(toDriverRef({ id: 'd1', name: ' ' })).toBeUndefined();
    expect(toDriverRef(null)).toBeUndefined();
    const b = toBooking('b1', { assignedDriver: { id: 'd1', name: 'Raju', phone: '9893302783' } });
    expect(JSON.stringify(b)).not.toContain('9893302783');
  });

  test('DriveBuddy’s confirmation, also while its time is still on the way', () => {
    expect(toDriverConfirmed({ at: ts('2026-11-25T04:00:00Z'), by: 'robot', driverId: 'd1' })).toEqual({
      at: new Date('2026-11-25T04:00:00Z'),
      by: 'robot',
      driverId: 'd1',
    });
    expect(toDriverConfirmed({ at: null, by: 'admin', driverId: 'd1' })).toEqual({
      by: 'admin',
      driverId: 'd1',
    });
    expect(toDriverConfirmed('yes')).toBeUndefined();
  });
});

describe('the driver card', () => {
  const CARD = {
    name: 'Raju Sahu',
    photoUrl: null,
    rating: 4.8,
    ratingCount: 23,
    trips: 120,
    experienceYears: 8,
    verified: true,
    since: ts('2026-03-01T00:00:00Z'),
  };

  test('read as the robot writes it', () => {
    expect(toDriverCard(CARD)).toEqual({ ...CARD, since: new Date('2026-03-01T00:00:00Z') });
  });

  test('odd or missing fields are left out, never shown as something they are not', () => {
    const odd = toDriverCard({
      name: 'Raju',
      photoUrl: 'http://not-https.example/p.jpg',
      rating: 9,
      ratingCount: -2,
      trips: 'many',
      experienceYears: 3.5,
      verified: 'yes',
    });
    expect(odd).toEqual({
      name: 'Raju',
      photoUrl: null,
      rating: null,
      ratingCount: 0,
      trips: 0,
      experienceYears: null,
      verified: false,
      since: null,
    });
    // A rating nobody gave is no rating.
    expect(toDriverCard({ ...CARD, ratingCount: 0 })?.rating).toBeNull();
    expect(toDriverCard({ ...CARD, photoUrl: 'https://cdn.example/raju.jpg' })?.photoUrl).toBe(
      'https://cdn.example/raju.jpg',
    );
    expect(toDriverCard({ ...CARD, name: '' })).toBeUndefined();
    expect(toDriverCard(undefined)).toBeUndefined();
  });

  test('initials until drivers have photos', () => {
    expect(initialsOf('Raju Sahu')).toBe('RS');
    expect(initialsOf('  raju  kumar  sahu ')).toBe('RS');
    expect(initialsOf('Raju')).toBe('R');
    expect(initialsOf('')).toBe('');
  });
});

describe('change driver', () => {
  test('twice per booking at most', () => {
    expect(DRIVER_CHANGES_MAX).toBe(2);
    expect(driverChangesLeft({ driverChanges: 0 })).toBe(2);
    expect(driverChangesLeft({ driverChanges: 1 })).toBe(1);
    expect(driverChangesLeft({ driverChanges: 5 })).toBe(0);
    expect(driverChangesLeft({})).toBe(2);
  });

  test('the robot’s count and list default to none', () => {
    const b = toBooking('b1', {});
    expect(b.driverChanges).toBe(0);
    expect(b.changedDrivers).toEqual([]);
    expect(b.driverChangeRequest).toBeUndefined();
    const c = toBooking('b2', { driverChanges: 1, changedDrivers: ['d1', 7, ''], driverChanges2: 'x' });
    expect(c.driverChanges).toBe(1);
    expect(c.changedDrivers).toEqual(['d1']);
    expect(toBooking('b3', { driverChanges: 1.5 }).driverChanges).toBe(0);
  });

  test('a request is pending from the moment it is written (its time comes later)', () => {
    expect(toDriverChangeRequest({ at: null, reason: '' })).toEqual({ reason: '' });
    expect(toDriverChangeRequest({ at: ts('2026-11-25T04:00:00Z'), reason: 'Too far' })).toEqual({
      at: new Date('2026-11-25T04:00:00Z'),
      reason: 'Too far',
    });
    expect(toDriverChangeRequest(null)).toBeUndefined();
  });

  test('the reason: trimmed and never longer than the rules allow, not even by half an emoji', () => {
    expect(changeReason('  he is too far away  ')).toBe('he is too far away');
    expect(changeReason('')).toBe('');
    expect(changeReason('a'.repeat(250))).toHaveLength(CHANGE_REASON_MAX);
    const emoji = changeReason('😀'.repeat(150));
    expect(emoji.length).toBeLessThanOrEqual(CHANGE_REASON_MAX);
    expect(emoji).toBe('😀'.repeat(100));
    expect(changeReason('ड्राइवर बहुत दूर है')).toBe('ड्राइवर बहुत दूर है');
  });
});

describe('job alerts', () => {
  test('what became of a push', () => {
    expect(toAlertResult({ at: ts('2026-11-25T04:00:00Z'), ok: true, error: null })).toEqual({
      at: new Date('2026-11-25T04:00:00Z'),
      ok: true,
      error: null,
    });
    expect(toAlertResult({ ok: false, error: 'InvalidCredentials' })).toEqual({
      ok: false,
      error: 'InvalidCredentials',
    });
    expect(toAlertResult({ ok: false })).toEqual({ ok: false, error: 'PushError' });
    expect(toAlertResult({ ok: 'yes' })).toBeUndefined();
    expect(toAlertResult(undefined)).toBeUndefined();
  });

  test('a test: asked (its time may still be on the way), then its result', () => {
    expect(toAlertTest({ at: null })).toEqual({});
    expect(
      toAlertTest({
        at: ts('2026-11-25T04:00:00Z'),
        result: { at: ts('2026-11-25T04:00:40Z'), ok: false, error: 'NoToken' },
      }),
    ).toEqual({
      at: new Date('2026-11-25T04:00:00Z'),
      result: { at: new Date('2026-11-25T04:00:40Z'), ok: false, error: 'NoToken' },
    });
    expect(toAlertTest([])).toBeUndefined();
  });
});

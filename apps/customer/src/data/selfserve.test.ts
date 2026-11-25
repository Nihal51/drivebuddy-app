import { getDoc, setDoc, updateDoc } from 'firebase/firestore';

import {
  acceptPrice,
  ratedOnPhone,
  ratingState,
  rememberRated,
  requestDriverChange,
  submitRating,
} from './selfserve';

jest.mock('@/firebase/app', () => ({ firestore: () => ({}) }));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db: unknown, col: string, id: string) => ({ path: `${col}/${id}` })),
  getDoc: jest.fn(),
  serverTimestamp: jest.fn(() => 'SERVER_TIME'),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
}));

const denied = () => Object.assign(new Error('denied'), { code: 'permission-denied' });
const offline = () => Object.assign(new Error('offline'), { code: 'unavailable' });

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn(async () => ({ ok: true })) as unknown as typeof fetch;
});

describe('accept price', () => {
  test('writes acceptedPrice and nothing else', async () => {
    (updateDoc as jest.Mock).mockResolvedValue(undefined);
    await expect(acceptPrice('b1', 1700)).resolves.toEqual({ ok: true });
    expect(updateDoc).toHaveBeenCalledWith(
      { path: 'bookings/b1' },
      { acceptedPrice: { amount: 1700, at: 'SERVER_TIME' } },
    );
  });

  test('a refusal or no internet comes back as a reason, never thrown', async () => {
    (updateDoc as jest.Mock).mockRejectedValue(denied());
    await expect(acceptPrice('b1', 1700)).resolves.toEqual({ ok: false, reason: 'permission' });
    (updateDoc as jest.Mock).mockRejectedValue(offline());
    await expect(acceptPrice('b1', 1700)).resolves.toEqual({ ok: false, reason: 'network' });
  });
});

describe('change driver', () => {
  const PING = 'https://script.google.com/macros/s/robot/exec';

  test('exactly driverChangeRequest = { at: server time, reason }, then the doorbell says what to look at', async () => {
    (updateDoc as jest.Mock).mockResolvedValue(undefined);
    await expect(requestDriverChange('b1', '  He is too far away  ', PING)).resolves.toEqual({ ok: true });
    expect(updateDoc).toHaveBeenCalledWith(
      { path: 'bookings/b1' },
      { driverChangeRequest: { at: 'SERVER_TIME', reason: 'He is too far away' } },
    );
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(PING);
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ action: 'driver-change' });
  });

  test('no reason is fine; a long one is cut to what the rules take', async () => {
    (updateDoc as jest.Mock).mockResolvedValue(undefined);
    await requestDriverChange('b1', '', PING);
    await requestDriverChange('b1', 'x'.repeat(260), PING);
    const reasons = (updateDoc as jest.Mock).mock.calls.map(
      ([, data]) => (data as { driverChangeRequest: { reason: string } }).driverChangeRequest.reason,
    );
    expect(reasons).toEqual(['', 'x'.repeat(200)]);
  });

  test('refused (he has set off, no changes left, one pending): a reason, and no doorbell', async () => {
    (updateDoc as jest.Mock).mockRejectedValue(denied());
    await expect(requestDriverChange('b1', '', PING)).resolves.toEqual({ ok: false, reason: 'permission' });
    (updateDoc as jest.Mock).mockRejectedValue(offline());
    await expect(requestDriverChange('b1', '', PING)).resolves.toEqual({ ok: false, reason: 'network' });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('rating', () => {
  test('exists → rated; missing → open; a refused read → unknown (try once)', async () => {
    (getDoc as jest.Mock).mockResolvedValueOnce({ exists: () => true });
    await expect(ratingState('b1')).resolves.toBe('rated');
    (getDoc as jest.Mock).mockResolvedValueOnce({ exists: () => false });
    await expect(ratingState('b1')).resolves.toBe('open');
    (getDoc as jest.Mock).mockRejectedValueOnce(denied());
    await expect(ratingState('b1')).resolves.toBe('unknown');
    expect(getDoc).toHaveBeenCalledWith({ path: 'ratings/b1' });
  });

  test('creates exactly the fields the rules accept', async () => {
    (setDoc as jest.Mock).mockResolvedValue(undefined);
    await expect(submitRating('b1', 5, ' Great ', 'd1', 'u1')).resolves.toBe('ok');
    expect(setDoc).toHaveBeenCalledWith(
      { path: 'ratings/b1' },
      { stars: 5, comment: 'Great', driverId: 'd1', customerUid: 'u1', at: 'SERVER_TIME' },
    );
  });

  test('a refusal means it was already rated; offline can be tried again', async () => {
    (setDoc as jest.Mock).mockRejectedValue(denied());
    await expect(submitRating('b1', 4, '', 'd1', 'u1')).resolves.toBe('already');
    (setDoc as jest.Mock).mockRejectedValue(offline());
    await expect(submitRating('b1', 4, '', 'd1', 'u1')).resolves.toBe('network');
  });

  test('a rating the rules would refuse never reaches the network', async () => {
    await expect(submitRating('b1', 0, '', 'd1', 'u1')).resolves.toBe('invalid');
    await expect(submitRating('b1', 5, 'x'.repeat(301), 'd1', 'u1')).resolves.toBe('invalid');
    expect(setDoc).not.toHaveBeenCalled();
  });

  test('a rating given on this phone is remembered', async () => {
    await expect(ratedOnPhone('b9')).resolves.toBeNull();
    await rememberRated('b9', 5);
    await expect(ratedOnPhone('b9')).resolves.toBe(5);
  });
});

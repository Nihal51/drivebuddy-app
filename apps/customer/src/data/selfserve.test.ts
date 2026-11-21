import { getDoc, setDoc, updateDoc } from 'firebase/firestore';

import { acceptPrice, ratedOnPhone, ratingState, rememberRated, submitRating } from './selfserve';

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

beforeEach(() => jest.clearAllMocks());

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

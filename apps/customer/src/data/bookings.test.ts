import type { BookingInput } from '@drivebuddy/shared';
import { setDoc } from 'firebase/firestore';

import { submitBooking } from './bookings';

jest.mock('@/firebase/app', () => ({ firestore: () => ({}) }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => 'bookings-collection'),
  doc: jest.fn(() => ({ id: 'abc123' })),
  serverTimestamp: jest.fn(() => 'SERVER_TIME'),
  setDoc: jest.fn(),
  onSnapshot: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
}));

const mockedSetDoc = setDoc as jest.Mock;

const INPUT: BookingInput = {
  name: 'Ravi',
  phone: '9876543210',
  city: 'Raipur',
  packageId: '1-hour-300',
  pickup: 'Shankar Nagar',
  preferredTime: '',
  notes: '',
};

beforeEach(() => mockedSetDoc.mockReset());

test('saves exactly the website-compatible document, tagged with the login', async () => {
  mockedSetDoc.mockResolvedValue(undefined);
  await expect(submitBooking(INPUT, 'uid-1')).resolves.toEqual({ ok: true, id: 'abc123' });
  expect(mockedSetDoc).toHaveBeenCalledWith(
    { id: 'abc123' },
    {
      name: 'Ravi',
      phone: '9876543210',
      city: 'Raipur',
      package: '1-hour-300',
      pickup: 'Shankar Nagar',
      preferredTime: '',
      notes: '',
      status: 'new',
      source: 'app',
      customerUid: 'uid-1',
      createdAt: 'SERVER_TIME',
    },
  );
});

test('a refused save is reported, never thrown', async () => {
  mockedSetDoc.mockRejectedValue(Object.assign(new Error('denied'), { code: 'permission-denied' }));
  await expect(submitBooking(INPUT, null)).resolves.toEqual({
    ok: false,
    reason: 'permission',
    id: 'abc123',
  });
  mockedSetDoc.mockRejectedValue(Object.assign(new Error('offline'), { code: 'unavailable' }));
  await expect(submitBooking(INPUT, null)).resolves.toMatchObject({ ok: false, reason: 'network' });
});

test('a save that hangs gives up and offers WhatsApp', async () => {
  mockedSetDoc.mockReturnValue(new Promise(() => {}));
  await expect(submitBooking(INPUT, null, { timeoutMs: 20 })).resolves.toEqual({
    ok: false,
    reason: 'timeout',
    id: 'abc123',
  });
});

test('an unchecked form never reaches the network', async () => {
  await expect(submitBooking({ ...INPUT, phone: '123' }, null)).resolves.toMatchObject({
    ok: false,
    reason: 'unknown',
  });
  expect(mockedSetDoc).not.toHaveBeenCalled();
});

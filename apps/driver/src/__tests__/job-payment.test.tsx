/**
 * The job screen after Job done (SPEC-upi item 4): the payment card, and the
 * job staying on screen once the robot completes it and the booking can no
 * longer be read. Firebase, the login and location sharing are stand-ins.
 */

import { toBooking } from '@drivebuddy/shared';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import JobScreen from '@/app/job/[id]';
import type { Job } from '@/data/jobs';
import type { TripTaps } from '@/data/tripTaps';
import { I18nProvider } from '@/i18n';
import { ThemeProvider } from '@/theme';

const PHONE = '9893302783';
let mockJobListener: (job: Job | null) => void = () => {};
let mockTapsListener: (taps: TripTaps | null | undefined) => void = () => {};
const mockRecordPayment = jest.fn(async () => ({ ok: true as const, already: false }));

jest.mock('expo-router', () => ({
  router: { replace: jest.fn() },
  useLocalSearchParams: () => ({ id: 'b1' }),
}));
jest.mock('@/auth/DriverAuth', () => ({
  useDriverAuth: () => ({
    state: { status: 'in', driver: { phone: '9893302783', uid: 'u1', driverId: 'd1', name: 'Raju' } },
  }),
}));
jest.mock('@/tracking/useSharing', () => ({ useSharing: () => null }));
jest.mock('@/tracking/sharing', () => ({ startSharing: jest.fn(), stopSharing: jest.fn() }));
jest.mock('@/data/offers', () => ({
  ...jest.requireActual('@/data/offers'),
  watchOffer: () => () => {},
}));
jest.mock('@/data/jobs', () => ({
  ...jest.requireActual('@/data/jobs'),
  watchJob: (_id: string, fn: (job: Job | null) => void) => {
    mockJobListener = fn;
    return () => {};
  },
}));
jest.mock('@/data/tripTaps', () => ({
  ...jest.requireActual('@/data/tripTaps'),
  watchTripTaps: (_id: string, fn: (taps: TripTaps | null | undefined) => void) => {
    mockTapsListener = fn;
    return () => {};
  },
  recordPayment: (...args: unknown[]) => (mockRecordPayment as (...a: unknown[]) => unknown)(...args),
}));

const JOB: Job = {
  ...toBooking('b1', {
    ref: 'DB-1042',
    name: 'Anita Verma',
    phone: '9876500000',
    package: '3-hours-600',
    city: 'Raipur',
    pickup: 'Shankar Nagar',
    status: 'assigned',
    assignedDriver: { id: 'd1', name: 'Raju', phone: PHONE },
  }),
  pickupGeo: null,
};
const at = (iso: string) => new Date(iso);
const DONE: TripTaps = {
  driverPhone: PHONE,
  leftAt: at('2026-11-21T04:00:00Z'),
  arrivedAt: at('2026-11-21T04:30:00Z'),
  doneAt: at('2026-11-21T07:40:00Z'),
};

async function show() {
  await render(
    <ThemeProvider scheme="light">
      <I18nProvider initial="en">
        <JobScreen />
      </I18nProvider>
    </ThemeProvider>,
  );
}

const emit = async (job: Job | null, taps: TripTaps | null | undefined) =>
  act(async () => {
    mockJobListener(job);
    mockTapsListener(taps);
  });

beforeEach(() => mockRecordPayment.mockClear());

test('after Job done: collect, then the bill; the robot completing the job keeps the screen', async () => {
  await show();
  await emit(JOB, DONE);
  expect(screen.getByText('Collect the payment — the amount shows here in a minute')).toBeOnTheScreen();
  expect(
    screen.getByText("UPI: the customer scans DriveBuddy's QR or taps Pay in the DriveBuddy app."),
  ).toBeOnTheScreen();
  // The robot bills it and completes the booking: he can no longer read it (null).
  await emit(null, { ...DONE, amount: 750 });
  expect(screen.queryByText('This job is no longer assigned to you.')).toBeNull();
  expect(screen.getByText('Collect ₹750 from the customer')).toBeOnTheScreen();
  expect(screen.getByText('Anita Verma')).toBeOnTheScreen(); // the details he had loaded
});

test('Paid in cash asks first, then writes once; the recorded payment shows with the way back', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _b, buttons) => {
    void buttons?.[1]?.onPress?.();
  });
  await show();
  await emit(null, { ...DONE, amount: 750 });
  await fireEvent.press(screen.getByTestId('paid-cash'));
  expect(alert).toHaveBeenCalledWith('Paid in cash?', expect.any(String), expect.any(Array));
  expect(mockRecordPayment).toHaveBeenCalledWith('b1', 'cash');
  await emit(null, { ...DONE, amount: 750, paidBy: 'cash' });
  expect(screen.getByText('Payment recorded ✓ · cash')).toBeOnTheScreen();
  expect(screen.getByTestId('payment-back')).toBeOnTheScreen();
  expect(screen.queryByTestId('paid-upi')).toBeNull();
  alert.mockRestore();
});

test('a job that is not his, with no Job done of his, still says so', async () => {
  await show();
  await emit(null, null);
  expect(screen.getByText('This job is no longer assigned to you.')).toBeOnTheScreen();
  await emit(null, { ...DONE, driverPhone: '9000000000' });
  expect(screen.queryByTestId('paid-cash')).toBeNull();
});

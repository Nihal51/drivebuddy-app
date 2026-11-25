/**
 * The job screen: never the customer's price (only his own pay is his to
 * see), the call-to-confirm line, and after Job done the payment card — also
 * once the robot completes the job and the booking can no longer be read.
 * Firebase, the login and location sharing are stand-ins.
 */

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import JobScreen from '@/app/job/[id]';
import { type Job, toJob } from '@/data/jobs';
import type { TripTaps } from '@/data/tripTaps';
import { I18nProvider } from '@/i18n';
import { ThemeProvider } from '@/theme';

const PHONE = '9893302783';
let mockJobListener: (job: Job | null) => void = () => {};
let mockTapsListener: (taps: TripTaps | null | undefined) => void = () => {};
const mockRecordPayment = jest.fn(async () => ({ ok: true as const, already: false }));
const mockTapTrip = jest.fn(async () => ({ ok: true as const, already: false }));

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
  tapTrip: (...args: unknown[]) => (mockTapTrip as (...a: unknown[]) => unknown)(...args),
}));

/* Everything the customer pays, with odd figures that cannot be mistaken for anything else on screen. */
const MONEY = {
  quote: {
    amount: 6111,
    dayRate: 1777,
    days: 3,
    returnHours: 0,
    returnHourRate: 0,
    returnCharge: 0,
    extraHours: 0,
    extraHourRate: 0,
    ticket: 0,
  },
  trip: {
    to: 'Nagpur',
    destId: 'nagpur',
    kind: 'one-way',
    km: 284,
    days: 1,
    returnHours: 8,
    estFrom: 5623,
    estTo: 5821,
  },
  acceptedPrice: { amount: 5821 },
  localBill: { amount: 4333, baseHours: 3, usedHours: 5, extraHours: 2, extraHourRate: 151 },
  bill: {
    amount: 7444,
    dayRate: 1777,
    days: 3,
    extraHours: 0,
    extraHourRate: 0,
    extraCharge: 0,
    returnHours: 0,
    returnHourRate: 0,
    returnCharge: 0,
    ticket: 0,
  },
  payment: { status: 'pending', method: 'upi', amount: 4333, url: 'upi://pay?pa=drivebuddy@ybl&am=4333.00' },
  notes:
    'Trip: Raipur → Nagpur · one-way drop · ~284 km · 1 day + 8 h getting home · est. ₹5,623–5,821\nAgreed Rs 6111 on the call, gate 2',
};
const FIGURES = [
  '6111',
  '6,111',
  '5623',
  '5,623',
  '5821',
  '5,821',
  '4333',
  '4,333',
  '7444',
  '7,444',
  '1777',
  '1,777',
  '151',
];

const JOB: Job = toJob('b1', {
  ref: 'DB-1042',
  name: 'Anita Verma',
  phone: '9876500000',
  package: '3-hours-600',
  city: 'Raipur',
  pickup: 'Shankar Nagar',
  status: 'assigned',
  assignedDriver: { id: 'd1', name: 'Raju', phone: PHONE },
  ...MONEY,
});
/** Every piece of text on screen, as one string. */
const allText = () => JSON.stringify(screen.toJSON());
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

beforeEach(() => {
  mockRecordPayment.mockClear();
  mockTapTrip.mockClear();
});

test('no customer price anywhere on the job screen, before or after Job done', async () => {
  await show();
  await emit(JOB, null);
  expect(screen.getByText('Anita Verma')).toBeOnTheScreen();
  expect(screen.getByText('Trip to Nagpur')).toBeOnTheScreen();
  expect(screen.getByText(/gate 2/)).toBeOnTheScreen(); // the notes, with the prices taken out
  for (const f of FIGURES) expect(allText()).not.toContain(f);
  await emit(JOB, DONE);
  for (const f of FIGURES) expect(allText()).not.toContain(f);
  await emit(null, DONE);
  for (const f of FIGURES) expect(allText()).not.toContain(f);
});

test('"Confirmed by DriveBuddy ✓" on his confirmed job (only his own confirmation)', async () => {
  await show();
  await emit(
    { ...JOB, driverConfirmed: { by: 'robot', driverId: 'd1', at: at('2026-11-21T03:00:00Z') } },
    null,
  );
  expect(screen.getByText('Confirmed by DriveBuddy ✓')).toBeOnTheScreen();
  await emit({ ...JOB, driverConfirmed: { by: 'robot', driverId: 'd9' } }, null);
  expect(screen.queryByTestId('driver-confirmed')).toBeNull();
});

test('after Job done: how the customer pays, no amount; the robot completing the job keeps the screen', async () => {
  await show();
  await emit(JOB, DONE);
  expect(
    screen.getByText(
      "The customer pays DriveBuddy, not you: Pay in the DriveBuddy app, or scan DriveBuddy's QR. If they give you cash, take what their bill says — it comes off your next payout.",
    ),
  ).toBeOnTheScreen();
  expect(screen.queryByTestId('driver-confirmed')).toBeNull();
  // The robot completes the booking: he can no longer read it (null).
  await emit(null, DONE);
  expect(screen.queryByText('This job is no longer assigned to you.')).toBeNull();
  expect(screen.getByTestId('paid-upi')).toBeOnTheScreen();
  expect(screen.getByText('Anita Verma')).toBeOnTheScreen(); // the details he had loaded
});

test('Paid in cash asks first, then writes once; the recorded payment shows with the way back', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _b, buttons) => {
    void buttons?.[1]?.onPress?.();
  });
  await show();
  await emit(null, DONE);
  await fireEvent.press(screen.getByTestId('paid-cash'));
  expect(alert).toHaveBeenCalledWith('Paid in cash?', expect.any(String), expect.any(Array));
  expect(mockRecordPayment).toHaveBeenCalledWith('b1', 'cash');
  await emit(null, { ...DONE, paidBy: 'cash' });
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

describe('a one-way drop after the drop (SPEC-v4)', () => {
  const ts = (iso: string) => ({ toDate: () => new Date(iso) });
  const ONE_WAY = (extra: Record<string, unknown> = {}): Job =>
    toJob('b1', {
      name: 'Anita Verma',
      phone: '9876500000',
      package: 'one-way-drop',
      city: 'Raipur',
      pickup: 'Shankar Nagar',
      status: 'assigned',
      assignedDriver: { id: 'd1', name: 'Raju', phone: PHONE },
      driverConfirmed: { by: 'robot', driverId: 'd1' },
      trip: {
        to: 'Ranchi',
        destId: 'ranchi',
        kind: 'one-way',
        km: 616,
        days: 1,
        returnHours: 21,
        estFrom: 3350,
        estTo: 3350,
      },
      ...extra,
    });
  const CHECK = {
    at: ts('2026-11-21T07:45:00Z'),
    options: [
      {
        train: '18452',
        name: 'Tapaswini Exp',
        from: 'RNC',
        dep: ts('2026-11-21T10:10:00Z'),
        change: null,
        waitMin: 145,
        waitCharge: 0,
        price: 2650,
      },
      {
        train: '12873',
        name: 'Jharkhand Exp',
        from: 'HTE',
        dep: ts('2026-11-21T21:00:00Z'),
        change: { station: 'JSG', train: '18109', dep: ts('2026-11-22T03:00:00Z') },
        waitMin: 795,
        waitCharge: 900,
        price: 3550,
      },
    ],
    bus: false,
    failed: false,
  };

  test('looking up trains, then the options (no prices); Boarded the train or home by bus', async () => {
    await show();
    await emit(ONE_WAY(), DONE);
    expect(screen.getByText('Looking up trains home…')).toBeOnTheScreen();
    expect(screen.getByTestId('tap-boardAt')).toBeOnTheScreen();
    expect(screen.getByTestId('tap-homeAt-bus')).toBeOnTheScreen();
    await emit(ONE_WAY({ returnCheck: CHECK }), DONE);
    expect(screen.getByText('Trains home (the customer books the ticket)')).toBeOnTheScreen();
    expect(screen.getByTestId('train-18452')).toHaveTextContent(/18452 Tapaswini Exp · RNC/);
    expect(screen.getByTestId('train-12873')).toHaveTextContent(/change at JSG → 18109/);
    for (const f of ['2650', '2,650', '3550', '3,550', '₹900']) expect(allText()).not.toContain(f);
  });

  test('chosen: "Your train"; boarded: only Reached home is left', async () => {
    const choice = { train: '18452', dep: ts('2026-11-21T10:10:00Z'), at: ts('2026-11-21T08:00:00Z') };
    await show();
    await emit(ONE_WAY({ returnCheck: CHECK, returnChoice: choice }), DONE);
    expect(screen.getByTestId('your-train')).toHaveTextContent(/Your train: 18452 at /);
    await emit(ONE_WAY({ returnCheck: CHECK, returnChoice: choice }), {
      ...DONE,
      boardAt: at('2026-11-21T10:12:00Z'),
    });
    expect(screen.getByTestId('tap-homeAt')).toBeOnTheScreen();
    expect(screen.queryByTestId('tap-homeAt-bus')).toBeNull();
    expect(screen.getByText('Boarded the train')).toBeOnTheScreen(); // in the trip times
  });

  test('Boarded asks first, then taps boardAt', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _b, buttons) => {
      void buttons?.[1]?.onPress?.();
    });
    await show();
    await emit(ONE_WAY({ returnCheck: CHECK }), DONE);
    await fireEvent.press(screen.getByTestId('tap-boardAt'));
    expect(alert).toHaveBeenCalledWith('Boarded the train?', expect.any(String), expect.any(Array));
    expect(mockTapTrip).toHaveBeenCalledWith('b1', 'boardAt', 'one-way-drop', PHONE);
    alert.mockRestore();
  });
});

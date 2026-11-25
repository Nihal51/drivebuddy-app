/**
 * My jobs before DriveBuddy's call: a "Waiting for confirmation" card from
 * his offer — his pay, no customer details — with "Can't make it"; the
 * confirmed job replaces it by itself. Firebase and the login are stand-ins.
 */

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import JobsScreen from '@/app/index';
import { type Job, toJob } from '@/data/jobs';
import { type Offer, toOffer } from '@/data/offers';
import { I18nProvider } from '@/i18n';
import { ThemeProvider } from '@/theme';

let mockJobs: (jobs: Job[] | null) => void = () => {};
let mockMyOffers: (offers: Offer[] | null) => void = () => {};
const mockRelease = jest.fn(async () => ({ ok: true as const }));

jest.mock('expo-router', () => ({ Redirect: () => null, router: { push: jest.fn(), replace: jest.fn() } }));
jest.mock('@/auth/DriverAuth', () => ({
  useDriverAuth: () => ({
    state: { status: 'in', driver: { phone: '9893302783', uid: 'u1', driverId: 'd1', name: 'Raju Sahu' } },
    logOut: jest.fn(),
  }),
}));
jest.mock('@/components/OffersSection', () => ({ OffersSection: () => null }));
jest.mock('@/tracking/useSharing', () => ({ useSharing: () => null }));
jest.mock('@/tracking/sharing', () => ({ stopSharing: jest.fn() }));
jest.mock('@/data/me', () => ({
  ...jest.requireActual('@/data/me'),
  readMyRecord: async () => ({
    name: 'Raju',
    city: 'Bhilai',
    status: 'active',
    upi: '',
    ratingCount: 0,
    strikes: 0,
  }),
}));
jest.mock('@/data/jobs', () => ({
  ...jest.requireActual('@/data/jobs'),
  watchJobs: (_phone: string, _driverId: string, fn: (jobs: Job[] | null) => void) => {
    mockJobs = fn;
    return () => {};
  },
}));
jest.mock('@/data/offers', () => ({
  ...jest.requireActual('@/data/offers'),
  watchMyOffers: (_driverId: string, fn: (offers: Offer[] | null) => void) => {
    mockMyOffers = fn;
    return () => {};
  },
  releaseJob: (...args: unknown[]) => (mockRelease as (...a: unknown[]) => unknown)(...args),
}));

const OFFER = toOffer('b1', {
  status: 'taken',
  takenBy: { id: 'd1', name: 'Raju Sahu', phone: '9893302783' },
  ref: 'DB-1042',
  city: 'Raipur',
  cities: ['Raipur', 'Bhilai', 'Durg'],
  package: '3-hours-600',
  when: '',
  area: 'Shankar Nagar',
  driverPay: 450,
  done: false,
  // Never on an offer, and never shown even if it were.
  name: 'Anita Verma',
  phone: '9876500000',
  pickup: 'House 12, Lane 4, Shankar Nagar',
  price: 6111,
});
const CONFIRMED: Job = toJob('b1', {
  name: 'Anita Verma',
  phone: '9876500000',
  package: '3-hours-600',
  city: 'Raipur',
  pickup: 'House 12, Lane 4, Shankar Nagar',
  status: 'assigned',
  assignedDriver: { id: 'd1', name: 'Raju Sahu', phone: '9893302783' },
  driverConfirmed: { by: 'robot', driverId: 'd1' },
});

async function show() {
  await render(
    <ThemeProvider scheme="light">
      <I18nProvider initial="en">
        <JobsScreen />
      </I18nProvider>
    </ThemeProvider>,
  );
  await act(async () => new Promise((r) => setTimeout(r, 0))); // his record (city)
}
/** No text on screen contains it. */
const nowhere = (s: string) =>
  expect(screen.queryAllByText(new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toHaveLength(0);

test('a taken offer waits for the call: his pay, where (with the city), and no customer details', async () => {
  await show();
  await act(async () => {
    mockJobs([]);
    mockMyOffers([OFFER]);
  });
  expect(screen.getByTestId('waiting-b1')).toBeOnTheScreen();
  expect(screen.getByText('WAITING FOR CONFIRMATION')).toBeOnTheScreen();
  expect(screen.getByText('You earn ₹450')).toBeOnTheScreen();
  expect(screen.getByText('Shankar Nagar · Raipur')).toBeOnTheScreen();
  expect(
    screen.getByText(
      "DriveBuddy will call you to confirm. The customer's name, number and address appear here after that.",
    ),
  ).toBeOnTheScreen();
  expect(screen.queryByText('No jobs right now')).toBeNull();
  for (const s of ['Anita', '9876500000', '98765 00000', 'House 12', 'Lane 4', '6111', '6,111']) nowhere(s);
  // The check itself finds text that is there: his own name, in the greeting.
  expect(screen.queryAllByText(/Raju/).length).toBeGreaterThan(0);
});

test('confirmed: the job replaces the waiting card by itself', async () => {
  await show();
  await act(async () => {
    mockJobs([]);
    mockMyOffers([OFFER]);
  });
  expect(screen.getByTestId('waiting-b1')).toBeOnTheScreen();
  await act(async () => mockJobs([CONFIRMED]));
  expect(screen.queryByTestId('waiting-b1')).toBeNull();
  expect(screen.getByTestId('job-b1')).toBeOnTheScreen();
});

test('nothing waits while his confirmed jobs are still loading', async () => {
  await show();
  await act(async () => mockMyOffers([OFFER]));
  expect(screen.queryByTestId('waiting-b1')).toBeNull();
});

test("Can't make it before the call: asks first, then gives it back", async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _b, buttons) => {
    void buttons?.[1]?.onPress?.();
  });
  await show();
  await act(async () => {
    mockJobs([]);
    mockMyOffers([OFFER]);
  });
  await fireEvent.press(screen.getByTestId('waiting-release-b1'));
  expect(alert).toHaveBeenCalledWith('Give this job back?', expect.any(String), expect.any(Array));
  expect(mockRelease).toHaveBeenCalledWith('b1', { driverId: 'd1', phone: '9893302783', uid: 'u1' }, false);
  alert.mockRestore();
});

test('an offer taken by his driver id alone (no number on it, from 25 Nov 2026) waits too', async () => {
  await show();
  await act(async () => {
    mockJobs([]);
    mockMyOffers([{ ...OFFER, id: 'b2', takenPhone: '' }]);
  });
  expect(screen.getByTestId('waiting-b2')).toBeOnTheScreen();
});

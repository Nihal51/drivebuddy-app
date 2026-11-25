/**
 * The "Job alerts" card on the home screen: it signs this phone up at start
 * (without popping the phone's question), says in words what works and what
 * does not, sends a test alert and shows its result, and on Android points
 * to the battery setting. Firebase, notifications and the location service
 * are stand-ins.
 */

import type { AlertTest } from '@drivebuddy/shared';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Linking, Platform } from 'react-native';

import type { Driver } from '@/auth/DriverAuth';
import { JobAlertsCard } from '@/components/JobAlertsCard';
import { type Availability, forgetThisPhone } from '@/data/alerts';
import type { MyRecord } from '@/data/me';
import { I18nProvider } from '@/i18n';
import type { AlertPermission } from '@/notifications/push';
import { ThemeProvider } from '@/theme';

const TOKEN = 'ExponentPushToken[abc123def456]';
const mock = {
  permission: 'granted' as AlertPermission,
  token: TOKEN,
  availability: (_a: Availability | null) => {},
  record: (_r: MyRecord | null) => {},
  test: (_t: AlertTest | null) => {},
  ask: jest.fn(async (_driverId: string) => ({ ok: true as const })),
  save: jest.fn(async (_me: unknown, _token: string) => true),
  tokenAsked: jest.fn((_channel: string, _ask?: boolean) => {}),
};

jest.mock('@/notifications/push', () => ({
  alertPermission: async () => mock.permission,
  jobAlertsToken: async (channel: string, ask?: boolean) => {
    mock.tokenAsked(channel, ask);
    return mock.permission === 'granted' ? mock.token : '';
  },
}));
jest.mock('@/tracking/sharing', () => ({
  savePushToken: (me: unknown, token: string) => mock.save(me, token),
}));
jest.mock('@/data/me', () => ({
  ...jest.requireActual('@/data/me'),
  watchMyRecord: (_id: string, fn: (r: MyRecord | null) => void) => {
    mock.record = fn;
    return () => {};
  },
}));
jest.mock('@/data/alerts', () => ({
  ...jest.requireActual('@/data/alerts'),
  watchAvailability: (_id: string, fn: (a: Availability | null) => void) => {
    mock.availability = fn;
    return () => {};
  },
  watchAlertTest: (_id: string, fn: (t: AlertTest | null) => void) => {
    mock.test = fn;
    return () => {};
  },
  askTestAlert: (driverId: string) => mock.ask(driverId),
}));

const DRIVER: Driver = { phone: '9893302783', uid: 'u1', driverId: 'd1', name: 'Raju' };
const ME = { city: 'Raipur', name: 'Raju Sahu' };

/** Lets the card's own async work (the sign-up, a tap's write) finish. */
const settle = () => act(async () => new Promise((r) => setTimeout(r, 0)));

async function show(online = false, lang: 'en' | 'hi' = 'en') {
  await render(
    <ThemeProvider scheme="light">
      <I18nProvider initial={lang}>
        <JobAlertsCard driver={DRIVER} me={ME} online={online} />
      </I18nProvider>
    </ThemeProvider>,
  );
  await settle(); // the sign-up at start
  await screen.findByTestId('alerts-permission');
}

beforeEach(() => {
  forgetThisPhone();
  mock.permission = 'granted';
  mock.ask.mockClear();
  mock.save.mockClear();
  mock.tokenAsked.mockClear();
});

test('at start: signs this phone up without asking, then says all is well', async () => {
  await show();
  expect(mock.tokenAsked).toHaveBeenCalledWith('Job offers', false);
  expect(mock.save).toHaveBeenCalledWith(
    { driverId: 'd1', city: 'Raipur', name: 'Raju Sahu', phone: '9893302783' },
    TOKEN,
  );
  await act(async () => {
    mock.availability({ online: false, pushToken: TOKEN });
    mock.record(null);
  });
  expect(screen.getByText('Working')).toBeOnTheScreen();
  expect(screen.getByText('Notifications allowed')).toBeOnTheScreen();
  expect(screen.getByText('Signed up for alerts on this phone')).toBeOnTheScreen();
  expect(screen.getByText('Offline — go online to get new job alerts')).toBeOnTheScreen();
  expect(screen.getByText('No alert has been sent to this phone yet.')).toBeOnTheScreen();
});

test('signed up once per start; after a logout the next login on this phone signs up again', async () => {
  await show();
  expect(mock.save).toHaveBeenCalledTimes(1);
  await screen.unmount();
  await show(); // the home screen again, same run: no second sign-up
  expect(mock.save).toHaveBeenCalledTimes(1);
  await screen.unmount();
  forgetThisPhone(); // DriverAuth.logOut
  await show();
  expect(mock.save).toHaveBeenCalledTimes(2);
});

test('another phone’s token, or none: not signed up here, with a way to sign up again', async () => {
  await show(true);
  await act(async () => mock.availability({ online: true, pushToken: 'ExponentPushToken[other-phone]' }));
  expect(screen.getByText('Not signed up for alerts on this phone yet')).toBeOnTheScreen();
  expect(screen.getByText('Needs attention')).toBeOnTheScreen();
  expect(screen.getByText('Online — new jobs near you come to this phone')).toBeOnTheScreen();
  await fireEvent.press(screen.getByTestId('alerts-signup'));
  await settle();
  expect(mock.tokenAsked).toHaveBeenLastCalledWith('Job offers', true);
});

test('notifications not allowed yet: Allow asks the phone', async () => {
  mock.permission = 'ask';
  await show();
  expect(mock.save).not.toHaveBeenCalled();
  expect(screen.getByText('Notifications are off — you will miss new jobs')).toBeOnTheScreen();
  await fireEvent.press(screen.getByText('Allow notifications'));
  await settle();
  expect(mock.tokenAsked).toHaveBeenLastCalledWith('Job offers', true);
});

test('notifications turned off for good: Open settings', async () => {
  mock.permission = 'blocked';
  const open = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
  await show();
  await fireEvent.press(screen.getByText('Open settings'));
  expect(open).toHaveBeenCalled();
  open.mockRestore();
});

test('the last alert did not arrive: why, in words', async () => {
  await show();
  await act(async () => {
    mock.availability({ online: false, pushToken: TOKEN });
    mock.record({
      name: 'Raju Sahu',
      city: 'Raipur',
      status: 'active',
      upi: '',
      ratingCount: 0,
      strikes: 0,
      lastAlert: { at: new Date(), ok: false, error: 'InvalidCredentials' },
    });
  });
  expect(screen.getByText('Needs attention')).toBeOnTheScreen();
  expect(screen.getByTestId('alerts-last')).toHaveTextContent(
    /Last alert did not arrive .*a setting at DriveBuddy\. The office has been told\./,
  );
});

test('Send me a test alert: asks once, shows it is on its way, then the result', async () => {
  await show();
  await act(async () => mock.test(null));
  await fireEvent.press(screen.getByTestId('alerts-test'));
  await settle();
  expect(mock.ask).toHaveBeenCalledWith('d1');
  const asked = new Date();
  await act(async () => mock.test({ at: asked }));
  expect(screen.getByText('Sending a test alert… the answer shows here in a minute.')).toBeOnTheScreen();
  // Not again within the minute.
  expect(screen.getByTestId('alerts-test')).toBeDisabled();
  await act(async () =>
    mock.test({ at: asked, result: { at: new Date(asked.getTime() + 20_000), ok: true, error: null } }),
  );
  expect(screen.getByTestId('alerts-test-result')).toHaveTextContent(/^Test alert sent ✓ Today, /);
  await act(async () =>
    mock.test({ at: asked, result: { at: new Date(asked.getTime() + 20_000), ok: false, error: 'NoToken' } }),
  );
  expect(screen.getByTestId('alerts-test-result')).toHaveTextContent(
    'The test alert did not arrive. This phone is not signed up for alerts. Allow notifications, then try again.',
  );
});

test('asked too soon: "wait a minute"', async () => {
  mock.ask.mockResolvedValueOnce({ ok: false, reason: 'too-soon' } as never);
  await show();
  await act(async () => mock.test(null));
  await fireEvent.press(screen.getByTestId('alerts-test'));
  await settle();
  expect(screen.getByText('Wait a minute before the next test.')).toBeOnTheScreen();
});

describe('Android', () => {
  beforeEach(() => jest.replaceProperty(Platform, 'OS', 'android'));
  afterEach(() => jest.restoreAllMocks());

  test('the battery setting, one tap to the app’s settings', async () => {
    const open = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    await show();
    expect(screen.getByText('Allow DriveBuddy to run in the background')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('alerts-battery'));
    expect(open).toHaveBeenCalled();
  });

  test('in Hindi too', async () => {
    await show(false, 'hi');
    expect(screen.getByText('काम के अलर्ट')).toBeOnTheScreen();
    expect(screen.getByText('DriveBuddy को बैकग्राउंड में चलने दें')).toBeOnTheScreen();
  });
});

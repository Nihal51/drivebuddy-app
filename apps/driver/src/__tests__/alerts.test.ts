/**
 * Job alerts that arrive (SPEC-privacy §3): the test alert (exactly the
 * write the rules take, then the robot's doorbell), the push token saved in
 * the robot's one place for it and kept while offline, and the card's
 * verdicts in words. Firestore is a stand-in that records what is written.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  alertErrorKind,
  alertsWork,
  askTestAlert,
  canAskTest,
  forgetThisPhone,
  markTokenSaved,
  newest,
  phoneToken,
  rememberPhoneToken,
  signedUpHere,
  testView,
  toAvailability,
  tokenSavedThisRun,
} from '@/data/alerts';
import { toMyRecord } from '@/data/me';
import { en } from '@/i18n/en';
import { lastAlertText, testText } from '@/i18n/format';
import { hi } from '@/i18n/hi';
import { permissionOf } from '@/notifications/push';
import { forgetPushToken, goOffline, savePushToken } from '@/tracking/sharing';

type Write = [op: string, path: string, data?: Record<string, unknown>];
const mockDb: {
  log: Write[];
  refuse: Set<string>;
  missing: Set<string>;
  docs: Record<string, Record<string, unknown>>;
} = {
  log: [],
  refuse: new Set(),
  missing: new Set(),
  docs: {},
};
const MOCK_SERVER_TIME = { serverTimestamp: true };
const MOCK_DELETE = { deleteField: true };

const mockFail = (code: string) => Object.assign(new Error(code), { code });

jest.mock('@/firebase/app', () => ({ firestore: () => ({}) }));
jest.mock('@/firebase/auth', () => ({ firebaseAuth: () => ({}) }));
jest.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...path: string[]) => path.join('/'),
  serverTimestamp: () => MOCK_SERVER_TIME,
  deleteField: () => MOCK_DELETE,
  onSnapshot: () => () => {},
  getDoc: async (path: string) => ({
    exists: () => path in mockDb.docs,
    data: () => mockDb.docs[path],
  }),
  setDoc: async (path: string, data: Record<string, unknown>) => {
    if (mockDb.refuse.has(path)) throw mockFail('permission-denied');
    mockDb.log.push(['set', path, data]);
  },
  updateDoc: async (path: string, data: Record<string, unknown>) => {
    if (mockDb.missing.has(path)) throw mockFail('not-found');
    if (mockDb.refuse.has(path)) throw mockFail('permission-denied');
    mockDb.log.push(['update', path, data]);
  },
}));

const ME = { driverId: 'd1', city: 'Raipur', name: 'Raju Sahu', phone: '9893302783' };
const TOKEN = 'ExponentPushToken[abc123def456]';
const at = (iso: string) => new Date(iso);

beforeEach(async () => {
  mockDb.log = [];
  mockDb.refuse = new Set();
  mockDb.missing = new Set();
  mockDb.docs = {};
  await AsyncStorage.clear();
  global.fetch = jest.fn(async () => ({ ok: true })) as unknown as typeof fetch;
});

describe('Send me a test alert', () => {
  test('exactly { at: server time } on his own test, then the doorbell says what to look at', async () => {
    await expect(askTestAlert('d1')).resolves.toEqual({ ok: true });
    expect(mockDb.log).toEqual([['set', 'alertTests/d1', { at: MOCK_SERVER_TIME }]]);
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/^https:\/\/script\.google\.com\//);
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ action: 'alert-test' });
  });

  test('refused (once a minute at most): "wait a minute", and no doorbell', async () => {
    mockDb.refuse.add('alertTests/d1');
    await expect(askTestAlert('d1')).resolves.toEqual({ ok: false, reason: 'too-soon' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('asked → waiting → the result for this ask (an older one belongs to the test before)', () => {
    expect(testView(null)).toEqual({ kind: 'none' });
    expect(testView({})).toEqual({ kind: 'waiting' }); // its time is still on the way
    const asked = { at: at('2026-11-25T04:00:00Z') };
    expect(testView(asked)).toEqual({ kind: 'waiting' });
    const result = { at: at('2026-11-25T04:00:40Z'), ok: true, error: null };
    expect(testView({ ...asked, result })).toEqual({ kind: 'done', result });
    expect(testView({ ...asked, result: { ...result, at: at('2026-11-25T03:00:00Z') } })).toEqual({
      kind: 'waiting',
    });
  });

  test('again only a minute after the last ask', () => {
    const asked = { at: at('2026-11-25T04:00:00Z') };
    expect(canAskTest(null)).toBe(true);
    expect(canAskTest(asked, Date.parse('2026-11-25T04:00:30Z'))).toBe(false);
    expect(canAskTest(asked, Date.parse('2026-11-25T04:01:00Z'))).toBe(true);
    expect(canAskTest({}, Date.parse('2026-11-25T04:01:00Z'))).toBe(false); // just asked
  });
});

describe('the push token', () => {
  test('saved where the robot looks for it, leaving the rest of the document (his spot) alone', async () => {
    await expect(savePushToken(ME, TOKEN)).resolves.toBe(true);
    expect(mockDb.log).toEqual([['update', 'availability/d1', { pushToken: TOKEN, at: MOCK_SERVER_TIME }]]);
  });

  test('never online before (no document): one is made, offline, with the token', async () => {
    mockDb.missing.add('availability/d1');
    await expect(savePushToken(ME, TOKEN)).resolves.toBe(true);
    expect(mockDb.log).toEqual([
      [
        'set',
        'availability/d1',
        {
          online: false,
          city: 'Raipur',
          name: 'Raju Sahu',
          phone: '9893302783',
          pushToken: TOKEN,
          at: MOCK_SERVER_TIME,
        },
      ],
    ]);
  });

  test('online: the saved state gets the new token too, so the 2-minute writes carry it', async () => {
    await AsyncStorage.setItem('dbd.online', JSON.stringify({ ...ME, token: 'ExponentPushToken[old]' }));
    await savePushToken(ME, TOKEN);
    expect(JSON.parse((await AsyncStorage.getItem('dbd.online')) ?? '{}').token).toBe(TOKEN);
  });

  test('no token, or not allowed (not Active): nothing saved', async () => {
    await expect(savePushToken(ME, '')).resolves.toBe(false);
    mockDb.refuse.add('availability/d1');
    mockDb.missing.add('availability/d1');
    await expect(savePushToken(ME, TOKEN)).resolves.toBe(false);
    expect(mockDb.log).toEqual([]);
  });

  test('going offline keeps it (reminders and tests still reach him); logging out drops it', async () => {
    await AsyncStorage.setItem('dbd.online', JSON.stringify({ ...ME, token: TOKEN }));
    await goOffline();
    expect(mockDb.log).toEqual([
      [
        'set',
        'availability/d1',
        {
          online: false,
          city: 'Raipur',
          name: 'Raju Sahu',
          phone: '9893302783',
          pushToken: TOKEN,
          at: MOCK_SERVER_TIME,
        },
      ],
    ]);
    mockDb.log = [];
    mockDb.docs['availability/d1'] = { online: false, pushToken: TOKEN };
    await forgetPushToken('d1', TOKEN);
    expect(mockDb.log).toEqual([
      ['update', 'availability/d1', { online: false, pushToken: MOCK_DELETE, at: MOCK_SERVER_TIME }],
    ]);
  });

  test('logging out of an old phone leaves the new phone’s token alone', async () => {
    mockDb.docs['availability/d1'] = { online: true, pushToken: 'ExponentPushToken[new-phone]' };
    await forgetPushToken('d1', TOKEN);
    await forgetPushToken('d1', ''); // this phone never got a token: nothing of it is saved
    expect(mockDb.log).toEqual([]);
  });

  test('logging out: whoever logs in next on this phone is signed up afresh', () => {
    rememberPhoneToken(TOKEN);
    markTokenSaved('d1');
    expect(tokenSavedThisRun('d1')).toBe(true);
    expect(phoneToken()).toBe(TOKEN);
    forgetThisPhone();
    expect(tokenSavedThisRun('d1')).toBe(false);
    expect(phoneToken()).toBe('');
  });

  test('signed up on this phone: a token saved, and it is this phone’s', () => {
    expect(signedUpHere('', TOKEN)).toBe(false);
    expect(signedUpHere(TOKEN, TOKEN)).toBe(true);
    expect(signedUpHere(TOKEN, 'ExponentPushToken[other-phone]')).toBe(false);
    expect(signedUpHere(TOKEN, '')).toBe(true); // this phone has not got its own yet
    expect(toAvailability({ online: true, pushToken: TOKEN })).toEqual({ online: true, pushToken: TOKEN });
    expect(toAvailability({ online: 'yes' })).toEqual({ online: false, pushToken: '' });
    expect(toAvailability(undefined)).toBeNull();
  });

  test('notifications: allowed, may be asked, or only the phone’s settings can change it', () => {
    expect(permissionOf({ status: 'granted' })).toBe('granted');
    expect(permissionOf({ status: 'undetermined', canAskAgain: true })).toBe('ask');
    expect(permissionOf({ status: 'denied', canAskAgain: false })).toBe('blocked');
  });
});

describe('in words', () => {
  const ok = { at: at('2026-11-25T05:12:00Z'), ok: true, error: null };
  const now = Date.parse('2026-11-25T06:00:00Z');

  test('the last alert, from his record', () => {
    expect(toMyRecord({ lastAlert: { at: ok.at, ok: true, error: null } }).lastAlert).toEqual(ok);
    expect(toMyRecord({}).lastAlert).toBeUndefined();
    expect(lastAlertText(en, undefined)).toBe('No alert has been sent to this phone yet.');
    expect(lastAlertText(en, ok, now)).toBe('Last alert reached this phone ✓ · Today, 10:42 am');
    expect(lastAlertText(en, { ...ok, ok: false, error: 'InvalidCredentials' }, now)).toBe(
      'Last alert did not arrive (Today, 10:42 am). Alerts cannot reach phones just now because of a setting at DriveBuddy. The office has been told.',
    );
    expect(lastAlertText(hi, ok, now)).toContain('✓');
  });

  test('every error Expo or the robot gives has words he can act on, in both languages', () => {
    expect(alertErrorKind('NoToken')).toBe('NoToken');
    expect(alertErrorKind('DeviceNotRegistered')).toBe('DeviceNotRegistered');
    expect(alertErrorKind('NoReceipt')).toBe('NoReceipt');
    expect(alertErrorKind('MismatchSenderId')).toBe('settings');
    expect(alertErrorKind('MessageRateExceeded')).toBe('other');
    expect(alertErrorKind(null)).toBe('other');
    for (const t of [en, hi])
      for (const why of Object.values(t.alerts.why)) expect(why.trim().length).toBeGreaterThan(10);
  });

  test('the test: waiting, then sent ✓ or why not', () => {
    expect(testText(en, { kind: 'none' })).toBeNull();
    expect(testText(en, { kind: 'waiting' })).toBe(en.alerts.testWaiting);
    expect(testText(en, { kind: 'done', result: ok }, now)).toMatch(/^Test alert sent ✓ Today, 10:42 am\./);
    expect(testText(hi, { kind: 'done', result: { ...ok, ok: false, error: 'NoToken' } }, now)).toBe(
      `टेस्ट अलर्ट नहीं पहुँचा। ${hi.alerts.why.NoToken}`,
    );
  });

  test('working = allowed, signed up here, and the newest outcome arrived (offline is no fault)', () => {
    expect(alertsWork({ permission: 'granted', signedUp: true })).toBe(true);
    expect(alertsWork({ permission: 'granted', signedUp: true, last: ok })).toBe(true);
    expect(alertsWork({ permission: 'ask', signedUp: true, last: ok })).toBe(false);
    expect(alertsWork({ permission: 'granted', signedUp: false })).toBe(false);
    const failed = { at: at('2026-11-25T05:30:00Z'), ok: false, error: 'DeviceNotRegistered' };
    expect(newest(ok, failed)).toBe(failed);
    expect(newest(failed, ok)).toBe(failed);
    expect(newest(undefined, ok)).toBe(ok);
    expect(alertsWork({ permission: 'granted', signedUp: true, last: newest(ok, failed) })).toBe(false);
  });
});

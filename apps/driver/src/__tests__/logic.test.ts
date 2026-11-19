import { readAnswer, requestCode, tenDigits, verifyCode } from '@/auth/robot';
import { navigateUrl, sortJobs, toJob } from '@/data/jobs';
import { en } from '@/i18n/en';
import { formatPreferred, loginErrorText, packageName, spacedPhone } from '@/i18n/format';
import { hi } from '@/i18n/hi';
import { inIndia, trackPoint } from '@/tracking/sharing';

describe('login', () => {
  test('ten-digit numbers', () => {
    expect(tenDigits('+91 98933-02783')).toBe('9893302783');
    expect(tenDigits('09893302783')).toBe('9893302783');
    expect(tenDigits('12345')).toBe('');
    expect(tenDigits('5893302783')).toBe('');
  });

  test('answers from the robot are typed, and anything odd is "unavailable"', () => {
    expect(readAnswer({ ok: true, session: 'abc', left: 2 }, (b) => typeof b.session === 'string')).toEqual({
      ok: true,
      session: 'abc',
      left: 2,
    });
    expect(readAnswer({ ok: true }, (b) => typeof b.session === 'string')).toEqual({
      ok: false,
      error: 'unavailable',
    });
    expect(readAnswer({ ok: false, error: 'limit', retryAt: 5 }, () => true)).toEqual({
      ok: false,
      error: 'limit',
      retryAt: 5,
    });
    expect(readAnswer({ ok: false, error: 'something-new' }, () => true)).toEqual({
      ok: false,
      error: 'unavailable',
    });
    expect(readAnswer('<html>', () => true)).toEqual({ ok: false, error: 'unavailable' });
  });

  test('requestCode / verifyCode post JSON to the robot; no network → "network"', async () => {
    const fetchMock = jest.fn(async () => ({ json: async () => ({ ok: true, session: 's1', left: 2 }) }));
    global.fetch = fetchMock as unknown as typeof fetch;
    await expect(requestCode('9893302783')).resolves.toEqual({ ok: true, session: 's1', left: 2 });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ action: 'driver-otp', phone: '9893302783' });

    global.fetch = jest.fn(async () => ({
      json: async () => ({ ok: true, token: 't', name: 'Raju', phone: '9893302783' }),
    })) as unknown as typeof fetch;
    await expect(verifyCode('s1', '123456')).resolves.toMatchObject({ ok: true, token: 't' });

    global.fetch = jest.fn(async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;
    await expect(requestCode('9893302783')).resolves.toEqual({ ok: false, error: 'network' });
    await expect(verifyCode('s1', '123456')).resolves.toEqual({ ok: false, error: 'network' });
  });

  test('every error has words in both languages', () => {
    const errors = Object.keys(en.login.errors) as (keyof typeof en.login.errors)[];
    for (const t of [en, hi]) {
      for (const error of errors)
        expect(
          loginErrorText(t, { error, triesLeft: 2, retryAt: Date.now() + 3600e3 }).length,
        ).toBeGreaterThan(5);
    }
    expect(loginErrorText(en, { error: 'wrong-code', triesLeft: 1 })).toContain('1 try left');
    expect(spacedPhone('9893302783')).toBe('98933 02783');
  });
});

describe('jobs', () => {
  const job = (id: string, extra: Record<string, unknown> = {}) =>
    toJob(id, {
      name: 'Ramesh',
      phone: '9111473929',
      city: 'Raipur',
      package: '3-hours-600',
      pickup: 'Shankar Nagar',
      preferredTime: '',
      notes: '',
      status: 'assigned',
      source: 'app',
      ...extra,
    });

  test('ASAP first, then by time', () => {
    const list = sortJobs([
      job('late', { preferredTime: '2026-11-20T18:00' }),
      job('asap'),
      job('soon', { preferredTime: '2026-11-20T09:30' }),
    ]);
    expect(list.map((j) => j.id)).toEqual(['asap', 'soon', 'late']);
  });

  test('Navigate goes to the pinned spot, or to the typed address', () => {
    expect(navigateUrl(job('a', { pickupGeo: { lat: 21.25, lng: 81.63 } }))).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=21.25,81.63&travelmode=driving',
    );
    expect(navigateUrl(job('b'))).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=Shankar%20Nagar%2C%20Raipur&travelmode=driving',
    );
    expect(job('c', { pickupGeo: { lat: 99, lng: 1 } }).pickupGeo).toBeNull();
  });

  test('words: package names and times', () => {
    expect(packageName(en, '3-hours-600')).toBe('3 hours');
    expect(packageName(hi, null)).toBe(hi.unknownPackage);
    expect(formatPreferred(en, '')).toBe('As soon as possible');
    const now = Date.parse('2026-11-20T04:00:00Z'); // 9:30 am in India
    expect(formatPreferred(en, '2026-11-20T15:30', now)).toBe('Today, 3:30 pm');
    expect(formatPreferred(en, '2026-11-21T08:00', now)).toBe('Sat, 21 Nov, 8:00 am');
  });
});

describe('live location', () => {
  const fix = (coords: Record<string, number | null>) => ({
    coords: {
      latitude: 21.2513844,
      longitude: 81.6296413,
      accuracy: 14.6,
      altitude: null,
      altitudeAccuracy: null,
      heading: 90.4,
      speed: 8.33,
      ...coords,
    },
    timestamp: Date.parse('2026-11-20T04:00:00Z'),
  });

  test('a GPS fix becomes exactly the fields the rules accept', () => {
    expect(trackPoint(fix({}) as never, '9893302783', 'Raju Sahu')).toEqual({
      lat: 21.251384,
      lng: 81.629641,
      acc: 15,
      heading: 90,
      speed: 8.3,
      active: true,
      phoneAt: new Date('2026-11-20T04:00:00Z'),
      driverPhone: '9893302783',
      driverName: 'Raju Sahu',
    });
    const bare = trackPoint(fix({ heading: -1, speed: -1, accuracy: null }) as never, '9893302783', '');
    expect(bare).not.toHaveProperty('heading');
    expect(bare).not.toHaveProperty('speed');
    expect(bare).not.toHaveProperty('driverName');
    expect(bare.acc).toBe(0);
  });

  test('fixes outside India are not sent', () => {
    expect(inIndia(fix({}) as never)).toBe(true);
    expect(inIndia(fix({ latitude: 51.5, longitude: -0.12 }) as never)).toBe(false);
  });
});

describe('job offers and earnings', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { earningsOf, toOffer } = require('@/data/offers') as typeof import('@/data/offers');
  const o = (id: string, extra: Record<string, unknown> = {}) =>
    toOffer(id, {
      ref: 'DB-1',
      city: 'Raipur',
      package: '3-hours-600',
      when: '',
      area: 'Shankar Nagar',
      to: '',
      driverPay: 450,
      status: 'taken',
      takenBy: { id: 'd1', name: 'Raju', phone: '9893302783' },
      takenAt: new Date('2026-11-20T04:00:00Z'),
      done: false,
      paid: false,
      paidAt: null,
      ...extra,
    });

  test('a stored offer is read safely', () => {
    const x = toOffer('b1', { status: 'odd', package: 'nope', driverPay: 'x' });
    expect(x.status).toBe('withdrawn');
    expect(x.packageId).toBeNull();
    expect(x.driverPay).toBe(0);
    expect(o('b2').takenPhone).toBe('9893302783');
  });

  test('owed = done and not paid; upcoming = not done; paid; cancelled jobs left out', () => {
    const e = earningsOf([
      o('a', { done: true }),
      o('b', { done: true, driverPay: 900 }),
      o('c'),
      o('d', { done: true, paid: true, driverPay: 700 }),
      o('e', { status: 'withdrawn', done: true }),
    ]);
    expect(e.owed).toBe(1350);
    expect(e.upcoming).toBe(450);
    expect(e.paid).toBe(700);
    expect(e.list.map((x) => x.id).sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  test('offer words exist in both languages', () => {
    expect(en.offers.youEarn('₹450')).toContain('₹450');
    expect(hi.offers.youEarn('₹450')).toContain('₹450');
    expect(hi.earnings.statusPaid('आज')).toContain('आज');
  });
});

describe('online for job alerts', () => {
  test('the words exist in both languages', () => {
    for (const t of [en, hi]) {
      expect(t.online.goOnline.length).toBeGreaterThan(2);
      expect(t.online.channel.length).toBeGreaterThan(2);
    }
  });

  test('a push token comes back when the phone allows alerts', async () => {
    const { jobAlertsToken } = jest.requireActual(
      '@/notifications/push',
    ) as typeof import('@/notifications/push');
    jest.doMock('expo-constants', () => ({ expoConfig: { extra: { eas: { projectId: 'p1' } } } }));
    const token = await jobAlertsToken('Job offers');
    expect(typeof token).toBe('string');
  });
});

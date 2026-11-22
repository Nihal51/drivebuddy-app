/** The "New job" popup's rules (data/popup.ts) and the job alerts around it (notifications/push.ts). */

import * as Notifications from 'expo-notifications';

import { type Offer, toOffer } from '@/data/offers';
import {
  POPUP_SECONDS,
  PopupController,
  expired,
  liveOffer,
  loadSeen,
  markSeen,
  nextPopup,
  offerIdOf,
  saveSeen,
  secondsLeft,
  tidySeen,
} from '@/data/popup';
import { foregroundBehaviour, watchOfferTaps } from '@/notifications/push';

const offer = (id: string, extra: Record<string, unknown> = {}): Offer =>
  toOffer(id, { status: 'open', city: 'Raipur', area: 'Shankar Nagar', driverPay: 450, ...extra });
const NOW = Date.parse('2026-11-23T10:00:00Z');

describe('which offer pops up next', () => {
  test('the first one he has not been shown, in the list’s order (soonest first)', () => {
    const list = [offer('a'), offer('b'), offer('c')];
    expect(nextPopup(list, {})).toEqual({ offer: list[0], raised: false });
    const seen = markSeen({}, list[0]!, NOW);
    expect(nextPopup(list, seen)?.offer.id).toBe('b');
    expect(nextPopup([], {})).toBeNull();
  });

  test('once shown (Accept, Not now or timed out) never again at the same or a lower pay', () => {
    const a = offer('a');
    const seen = markSeen({}, a, NOW);
    expect(nextPopup([a], seen)).toBeNull();
    expect(nextPopup([offer('a', { driverPay: 400 })], seen)).toBeNull();
  });

  test('again, as "Pay raised", when the pay went up since', () => {
    const seen = markSeen({}, offer('a'), NOW);
    const raised = offer('a', { driverPay: 520 });
    expect(nextPopup([raised], seen)).toEqual({ offer: raised, raised: true });
    // Shown at the new pay: not again until it rises once more.
    expect(nextPopup([raised], markSeen(seen, raised, NOW))).toBeNull();
  });

  test('only open offers', () => {
    expect(nextPopup([offer('a', { status: 'taken' }), offer('b')], {})?.offer.id).toBe('b');
  });

  test('the open offer as it is now; gone when taken, withdrawn or not in his list', () => {
    const list = [offer('a', { driverPay: 500 }), offer('b', { status: 'withdrawn' })];
    expect(liveOffer(list, 'a')?.driverPay).toBe(500);
    expect(liveOffer(list, 'b')).toBeNull();
    expect(liveOffer(list, 'zz')).toBeNull();
  });
});

describe('the 30-second countdown', () => {
  test('counts down in whole seconds and expires at 0', () => {
    expect(POPUP_SECONDS).toBe(30);
    expect(secondsLeft(NOW, NOW)).toBe(30);
    expect(secondsLeft(NOW, NOW + 400)).toBe(30);
    expect(secondsLeft(NOW, NOW + 1000)).toBe(29);
    expect(secondsLeft(NOW, NOW + 29_001)).toBe(1);
    expect(secondsLeft(NOW, NOW + 30_000)).toBe(0);
    expect(secondsLeft(NOW, NOW + 90_000)).toBe(0); // back from the background long after
    expect(expired(NOW, NOW + 29_999)).toBe(false);
    expect(expired(NOW, NOW + 30_000)).toBe(true);
  });
});

describe('what he was shown, kept on the phone', () => {
  test('odd entries and ones older than a week are dropped; the newest 300 kept', () => {
    const week = 7 * 24 * 60 * 60 * 1000;
    expect(
      tidySeen(
        {
          a: { pay: 450, at: NOW - 1000 },
          old: { pay: 450, at: NOW - week - 1 },
          odd: { pay: '450', at: NOW },
          nul: null,
        },
        NOW,
      ),
    ).toEqual({ a: { pay: 450, at: NOW - 1000 } });
    expect(tidySeen('x', NOW)).toEqual({});
    expect(tidySeen([1, 2], NOW)).toEqual({});
    const many = Object.fromEntries(
      Array.from({ length: 350 }, (_, i) => [`o${i}`, { pay: 1, at: NOW - i }]),
    );
    const kept = tidySeen(many, NOW);
    expect(Object.keys(kept)).toHaveLength(300);
    expect(kept.o0).toBeDefined();
    expect(kept.o349).toBeUndefined();
  });

  test('saved and read back', async () => {
    await saveSeen(markSeen({}, offer('a'), NOW), NOW);
    await expect(loadSeen(NOW + 1000)).resolves.toEqual({ a: { pay: 450, at: NOW } });
  });
});

describe('job alerts', () => {
  test('the offer id in the alert’s data, only when it looks like one', () => {
    expect(offerIdOf({ offerId: 'AbC_12-x' })).toBe('AbC_12-x');
    for (const bad of [{}, { offerId: 7 }, { offerId: '' }, { offerId: '../x' }, null, 'abc'])
      expect(offerIdOf(bad)).toBeNull();
  });

  test('in front, a job alert only sounds (the popup shows it); others and in the background show as usual', () => {
    expect(foregroundBehaviour({ offerId: 'b1' }, 'active')).toEqual({
      shouldShowBanner: false,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    });
    expect(foregroundBehaviour({ offerId: 'b1' }, 'background').shouldShowBanner).toBe(true);
    expect(foregroundBehaviour({ other: 1 }, 'active')).toMatchObject({
      shouldShowBanner: true,
      shouldPlaySound: true,
    });
  });

  test('a tap: the one that started the app and later ones, each once', async () => {
    const response = (identifier: string, data: unknown) =>
      ({
        notification: { request: { identifier, content: { data } } },
      }) as Notifications.NotificationResponse;
    let listener: (r: Notifications.NotificationResponse) => void = () => {};
    (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockImplementation((fn) => {
      listener = fn;
      return { remove: jest.fn() };
    });
    (Notifications.getLastNotificationResponseAsync as jest.Mock).mockResolvedValueOnce(
      response('n1', { offerId: 'b1' }),
    );
    const seen: string[] = [];
    const off = watchOfferTaps((id) => seen.push(id));
    await new Promise((r) => setTimeout(r, 0));
    expect(seen).toEqual(['b1']);
    expect(Notifications.clearLastNotificationResponse).toHaveBeenCalled();
    listener(response('n1', { offerId: 'b1' })); // the same one again: ignored
    listener(response('n2', { offerId: 'b2' }));
    listener(response('n3', { other: 'x' })); // not a job alert
    expect(seen).toEqual(['b1', 'b2']);
    off();
  });
});

describe('the queue: one popup at a time', () => {
  const setup = () => {
    let clock = NOW;
    const fx = { now: () => clock, buzz: jest.fn(), gone: jest.fn(), save: jest.fn() };
    const ctl = new PopupController(fx);
    ctl.onGone(fx.gone);
    return { ctl, fx, tick: (ms: number) => (clock += ms) };
  };

  test('nothing until what he saw before is read from the phone, then only while Online, in front and loaded', () => {
    const { ctl } = setup();
    ctl.update({ offers: [offer('a')], loaded: true, watching: true, canPop: true });
    expect(ctl.getView()).toBeNull();
    ctl.seenLoaded(markSeen({}, offer('a'), NOW - 1000)); // dismissed before the restart
    expect(ctl.getView()).toBeNull();
    ctl.update({ offers: [offer('a'), offer('b')] });
    expect(ctl.getView()?.offer.id).toBe('b');
  });

  test('Offline, in the background or still loading: no popup by itself', () => {
    const { ctl } = setup();
    ctl.seenLoaded({});
    ctl.update({ offers: [offer('a')], loaded: true, watching: true, canPop: false });
    expect(ctl.getView()).toBeNull();
    ctl.update({ canPop: true, front: false });
    expect(ctl.getView()).toBeNull();
    ctl.update({ front: true, loaded: false });
    expect(ctl.getView()).toBeNull();
    ctl.update({ loaded: true });
    expect(ctl.getView()?.offer.id).toBe('a');
  });

  test('one at a time with a buzz; Not now → the next; never the same one twice, saved on the phone', () => {
    const { ctl, fx } = setup();
    ctl.seenLoaded({});
    ctl.update({ offers: [offer('a'), offer('b')], loaded: true, watching: true, canPop: true });
    expect(ctl.getView()?.offer.id).toBe('a');
    expect(fx.buzz).toHaveBeenLastCalledWith(true);
    ctl.update({ offers: [offer('a'), offer('b'), offer('c')] }); // a stays up; c waits
    expect(ctl.getView()?.offer.id).toBe('a');
    ctl.dismiss();
    expect(ctl.getView()?.offer.id).toBe('b');
    ctl.dismiss();
    expect(ctl.getView()?.offer.id).toBe('c');
    ctl.dismiss();
    expect(ctl.getView()).toBeNull();
    ctl.update({ offers: [offer('a'), offer('b'), offer('c')] });
    expect(ctl.getView()).toBeNull();
    expect(Object.keys(fx.save.mock.calls.at(-1)[0]).sort()).toEqual(['a', 'b', 'c']);
  });

  test('pay raised: back as "Pay raised"; raised while open → remembered at the new pay', () => {
    const { ctl } = setup();
    ctl.seenLoaded({});
    ctl.update({ offers: [offer('a')], loaded: true, watching: true, canPop: true });
    ctl.update({ offers: [offer('a', { driverPay: 500 })] }); // while open: shows the new pay
    expect(ctl.getView()).toMatchObject({ raised: false, offer: { driverPay: 500 } });
    ctl.dismiss();
    ctl.update({ offers: [offer('a', { driverPay: 500 })] });
    expect(ctl.getView()).toBeNull();
    ctl.update({ offers: [offer('a', { driverPay: 600 })] });
    expect(ctl.getView()).toMatchObject({ raised: true, offer: { driverPay: 600 } });
  });

  test('taken by someone else while open: closes with "gone" — but not while he is accepting it', async () => {
    const { ctl, fx } = setup();
    ctl.seenLoaded({});
    ctl.update({ offers: [offer('a')], loaded: true, watching: true, canPop: true });
    ctl.update({ offers: [] });
    expect(ctl.getView()).toBeNull();
    expect(fx.gone).toHaveBeenCalledTimes(1);
    expect(fx.buzz).toHaveBeenLastCalledWith(false);

    ctl.update({ offers: [offer('b')] });
    let finish: (words: string) => void = () => {};
    const take = jest.fn(() => new Promise<string>((r) => (finish = r)));
    const accepting = ctl.accept(take);
    expect(ctl.getView()?.busy).toBe(true);
    ctl.update({ offers: [] }); // his own accept took it
    expect(ctl.getView()?.offer.id).toBe('b');
    finish('The job is yours.');
    await expect(accepting).resolves.toBe('The job is yours.');
    expect(take).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }));
    expect(ctl.getView()).toBeNull();
    expect(fx.gone).toHaveBeenCalledTimes(1);
  });

  test('a tapped alert: that offer first (even Offline), once loaded; one not open for him → gone', () => {
    const { ctl, fx } = setup();
    ctl.seenLoaded(markSeen({}, offer('t1'), NOW));
    ctl.update({ watching: true, canPop: false, loaded: false });
    ctl.tap('t1');
    expect(ctl.getView()).toBeNull(); // waits for his offers
    ctl.update({ offers: [offer('t0'), offer('t1')], loaded: true });
    expect(ctl.getView()?.offer.id).toBe('t1'); // seen before: a tap still opens it
    ctl.dismiss();
    ctl.tap('nope');
    expect(ctl.getView()).toBeNull();
    expect(fx.gone).toHaveBeenCalledTimes(1);
    // Not Active (his offers are not listened to): gone at once.
    ctl.update({ watching: false });
    ctl.tap('t0');
    expect(fx.gone).toHaveBeenCalledTimes(2);
  });

  test('the countdown starts when it opens', () => {
    const { ctl, tick } = setup();
    ctl.seenLoaded({});
    tick(5000);
    ctl.update({ offers: [offer('a')], loaded: true, watching: true, canPop: true });
    const opened = ctl.getView()?.openedAt ?? 0;
    expect(opened).toBe(NOW + 5000);
    expect(expired(opened, NOW + 5000 + 29_000)).toBe(false);
    expect(expired(opened, NOW + 5000 + 30_000)).toBe(true);
  });
});

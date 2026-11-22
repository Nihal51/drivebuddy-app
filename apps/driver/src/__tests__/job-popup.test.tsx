/**
 * The "New job" popup on screen: his pay and never the customer's price,
 * Accept, Not now, the countdown; and the host that pops offers one at a
 * time, never twice unless the pay went up, and closes one that is gone.
 */

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { Alert, Vibration } from 'react-native';

import { JobPopup } from '@/components/JobPopup';
import { JobPopupHost } from '@/components/JobPopupHost';
import { type Offer, toOffer } from '@/data/offers';
import { I18nProvider } from '@/i18n';
import { ThemeProvider } from '@/theme';

let mockTap: (offerId: string) => void = () => {};

jest.mock('expo-router', () => ({ router: { canDismiss: () => false, dismissAll: jest.fn() } }));
jest.mock('@/notifications/push', () => ({
  watchOfferTaps: (fn: (id: string) => void) => {
    mockTap = fn;
    return () => {};
  },
}));

const offer = (id: string, extra: Record<string, unknown> = {}): Offer =>
  toOffer(id, {
    status: 'open',
    ref: 'DB-1042',
    city: 'Raipur',
    package: '3-hours-600',
    when: '',
    area: 'Shankar Nagar',
    driverPay: 450,
    // In the document, never on screen.
    price: 6111,
    cutPercent: 37,
    ...extra,
  });

const wrap = (ui: ReactElement) => (
  <ThemeProvider scheme="light">
    <I18nProvider initial="en">{ui}</I18nProvider>
  </ThemeProvider>
);
const allText = () => JSON.stringify(screen.toJSON());

let alert: jest.SpyInstance;
let vibrate: jest.SpyInstance;
beforeEach(() => {
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  vibrate = jest.spyOn(Vibration, 'vibrate').mockImplementation(() => {});
  jest.spyOn(Vibration, 'cancel').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('the popup', () => {
  const props = () => ({
    offer: offer('b1', { city: 'Bhilai' }),
    raised: false,
    myCity: 'Raipur',
    openedAt: Date.now(),
    busy: false,
    onAccept: jest.fn(),
    onDismiss: jest.fn(),
    onTimeout: jest.fn(),
  });

  test('what, where (and which city when it is a nearby one), when, and his pay — no price, no cut', async () => {
    await render(wrap(<JobPopup {...props()} />));
    expect(screen.getByText('NEW JOB')).toBeOnTheScreen();
    expect(screen.getByText('3 hours')).toBeOnTheScreen();
    expect(screen.getByText('Shankar Nagar · Bhilai')).toBeOnTheScreen();
    expect(screen.getByText('As soon as possible')).toBeOnTheScreen();
    expect(screen.getByText('You earn ₹450')).toBeOnTheScreen();
    expect(screen.getByText('Closes in 30 s')).toBeOnTheScreen();
    for (const f of ['6111', '6,111', '37']) expect(allText()).not.toContain(f);
  });

  test('Accept and Not now', async () => {
    const p = props();
    await render(wrap(<JobPopup {...p} />));
    await fireEvent.press(screen.getByTestId('popup-accept'));
    expect(p.onAccept).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByTestId('popup-not-now'));
    expect(p.onDismiss).toHaveBeenCalledTimes(1);
  });

  test('closes by itself after 30 seconds, once', async () => {
    jest.useFakeTimers();
    const p = props();
    await render(wrap(<JobPopup {...p} />));
    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });
    expect(screen.getByText('Closes in 20 s')).toBeOnTheScreen();
    expect(p.onTimeout).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(25_000);
    });
    expect(p.onTimeout).toHaveBeenCalledTimes(1);
  });

  test('"Pay raised" when it comes back with more pay', async () => {
    await render(wrap(<JobPopup {...props()} raised />));
    expect(screen.getByText('PAY RAISED')).toBeOnTheScreen();
  });
});

describe('the host', () => {
  type HostProps = Parameters<typeof JobPopupHost>[0];
  const base = (extra: Partial<HostProps> = {}): HostProps => ({
    offers: [],
    loaded: true,
    watching: true,
    canPop: true,
    myCity: 'Raipur',
    onTake: jest.fn(async () => 'The job is yours.'),
    ...extra,
  });
  const settle = () => act(async () => new Promise((r) => setTimeout(r, 0)));

  test('Online: a new offer pops up with a buzz; Not now → it never comes back; the next one follows', async () => {
    const view = await render(wrap(<JobPopupHost {...base({ offers: [offer('a'), offer('b')] })} />));
    await settle();
    expect(screen.getByTestId('job-popup')).toBeOnTheScreen();
    expect(vibrate).toHaveBeenCalled();
    expect(screen.getByText('You earn ₹450')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('popup-not-now'));
    await settle();
    // b now; then nothing (a was dismissed).
    await fireEvent.press(screen.getByTestId('popup-not-now'));
    await settle();
    expect(screen.queryByTestId('job-popup')).toBeNull();
    await view.rerender(wrap(<JobPopupHost {...base({ offers: [offer('a'), offer('b')] })} />));
    await settle();
    expect(screen.queryByTestId('job-popup')).toBeNull();
    // The pay on a went up: it comes back as "Pay raised".
    await view.rerender(
      wrap(<JobPopupHost {...base({ offers: [offer('a', { driverPay: 550 }), offer('b')] })} />),
    );
    await settle();
    expect(screen.getByText('PAY RAISED')).toBeOnTheScreen();
    expect(screen.getByText('You earn ₹550')).toBeOnTheScreen();
  });

  test('Offline: no popup by itself', async () => {
    await render(wrap(<JobPopupHost {...base({ offers: [offer('c1')], canPop: false })} />));
    await settle();
    expect(screen.queryByTestId('job-popup')).toBeNull();
  });

  test('Accept takes it through the accept function, then closes with its words', async () => {
    const onTake = jest.fn(async () => 'The job is yours.');
    await render(wrap(<JobPopupHost {...base({ offers: [offer('d1')], onTake })} />));
    await settle();
    await fireEvent.press(screen.getByTestId('popup-accept'));
    await settle();
    expect(onTake).toHaveBeenCalledWith(expect.objectContaining({ id: 'd1', driverPay: 450 }));
    expect(screen.queryByTestId('job-popup')).toBeNull();
    expect(alert).toHaveBeenCalledWith('DriveBuddy Driver', 'The job is yours.');
  });

  test('taken by someone else while open: closes with "another driver took it"', async () => {
    const view = await render(wrap(<JobPopupHost {...base({ offers: [offer('e1')] })} />));
    await settle();
    expect(screen.getByTestId('job-popup')).toBeOnTheScreen();
    await view.rerender(wrap(<JobPopupHost {...base({ offers: [] })} />));
    await settle();
    expect(screen.queryByTestId('job-popup')).toBeNull();
    expect(alert).toHaveBeenCalledWith('DriveBuddy Driver', 'Another driver took this job first.');
  });

  test('a tapped job alert opens that offer (even Offline); one no longer open says so', async () => {
    await render(wrap(<JobPopupHost {...base({ offers: [offer('f1')], canPop: false })} />));
    await settle();
    await act(async () => mockTap('f1'));
    await settle();
    expect(screen.getByTestId('job-popup')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('popup-not-now'));
    await act(async () => mockTap('gone-1'));
    await settle();
    expect(screen.queryByTestId('job-popup')).toBeNull();
    expect(alert).toHaveBeenCalledWith('DriveBuddy Driver', 'Another driver took this job first.');
  });
});

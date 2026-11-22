/**
 * New job offers: only what the driver earns, never what the customer pays or
 * DriveBuddy's cut — even when the offer document carries them.
 */

import { act, render, screen } from '@testing-library/react-native';

import type { Driver } from '@/auth/DriverAuth';
import { OffersSection } from '@/components/OffersSection';
import { type Offer, toOffer } from '@/data/offers';
import { I18nProvider } from '@/i18n';
import { ThemeProvider } from '@/theme';

let mockOffersListener: (offers: Offer[] | null) => void = () => {};

jest.mock('@/components/OnlineCard', () => ({ OnlineCard: () => null }));
jest.mock('expo-router', () => ({ router: { canDismiss: () => false, dismissAll: jest.fn() } }));
jest.mock('@/data/me', () => ({
  ...jest.requireActual('@/data/me'),
  readMyRecord: async () => ({
    name: 'Raju',
    city: 'Raipur',
    status: 'active',
    upi: '',
    ratingCount: 0,
    strikes: 0,
  }),
}));
jest.mock('@/data/offers', () => ({
  ...jest.requireActual('@/data/offers'),
  watchOpenOffers: (_city: string, fn: (offers: Offer[] | null) => void) => {
    mockOffersListener = fn;
    return () => {};
  },
}));

const DRIVER: Driver = { phone: '9893302783', uid: 'u1', driverId: 'd1', name: 'Raju' };

test('an offer shows "You earn ₹X" and nothing of the customer’s price or the cut', async () => {
  await render(
    <ThemeProvider scheme="light">
      <I18nProvider initial="en">
        <OffersSection driver={DRIVER} />
      </I18nProvider>
    </ThemeProvider>,
  );
  await act(async () => {
    mockOffersListener([
      toOffer('b1', {
        status: 'open',
        ref: 'DB-1042',
        city: 'Raipur',
        cities: ['Raipur'],
        package: 'outstation',
        when: '2026-11-25T08:00',
        area: 'Shankar Nagar',
        to: 'Nagpur',
        driverPay: 1350,
        price: 6111,
        cutPercent: 37,
        quote: { amount: 6111 },
      }),
      // The whole zone gets it: from Bhilai, so the card says which city.
      toOffer('b2', {
        status: 'open',
        city: 'Bhilai',
        cities: ['Bhilai', 'Durg', 'Raipur'],
        package: '1-hour-300',
        when: '',
        area: 'Supela',
        driverPay: 210,
      }),
    ]);
  });
  expect(screen.getByText('You earn ₹1,350')).toBeOnTheScreen();
  expect(screen.getByText('Shankar Nagar')).toBeOnTheScreen(); // his own city: no city
  expect(screen.getByText('Supela · Bhilai')).toBeOnTheScreen();
  const text = JSON.stringify(screen.toJSON());
  for (const f of ['6111', '6,111', '37%', 'cut']) expect(text).not.toContain(f);
});

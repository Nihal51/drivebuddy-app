import { DEFAULT_CONFIG } from '@drivebuddy/shared';
import { fireEvent, screen } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import AccountScreen from '@/app/(tabs)/account';
import BookScreen from '@/app/book';
import HomeScreen from '@/app/(tabs)/index';
import { submitBooking } from '@/data/bookings';

import { renderScreen, signedOut } from './test-utils';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), dismissTo: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
  Stack: { Screen: () => null },
}));
jest.mock('@/data/bookings', () => ({ submitBooking: jest.fn() }));
jest.mock('@/firebase/google', () => ({ isGoogleLoginAvailable: () => false }));

const mockedSubmit = submitBooking as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Home', () => {
  test('one question and eight services, with the live prices from the website', async () => {
    const config = { ...DEFAULT_CONFIG, prices: { ...DEFAULT_CONFIG.prices, oneHour: 350, threeHours: 650 } };
    await renderScreen(<HomeScreen />, { config });
    expect(screen.getByText('What do you need?')).toBeOnTheScreen();
    expect(screen.getAllByTestId(/^tile-/)).toHaveLength(8);
    expect(screen.getByTestId('tile-hourly')).toHaveTextContent(/from ₹350/);
    expect(screen.getByTestId('tile-drop')).toHaveTextContent(/₹1,450–1,650\/day/);
  });

  test('a one-service tile opens the details step; a two-service tile opens the choice', async () => {
    await renderScreen(<HomeScreen />);
    await fireEvent.press(screen.getByTestId('tile-outstation'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/book', params: { package: 'outstation' } });
    await fireEvent.press(screen.getByTestId('tile-hourly'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/book', params: { category: 'hourly' } });
  });

  test('switches to Hindi', async () => {
    await renderScreen(<HomeScreen />);
    await fireEvent.press(screen.getByRole('radio', { name: 'हिंदी' }));
    expect(screen.getByText('आपको क्या चाहिए?')).toBeOnTheScreen();
    expect(screen.getByText('रात का ड्राइवर')).toBeOnTheScreen();
  });

  test('the notice bar follows the website setting', async () => {
    await renderScreen(<HomeScreen />, {
      config: { ...DEFAULT_CONFIG, notice: { show: true, text: 'Diwali week: book early' } },
    });
    expect(screen.getByText('Diwali week: book early')).toBeOnTheScreen();
  });
});

const mockedParams = useLocalSearchParams as jest.Mock;
/** Opens the booking as Home would: with a service already chosen (step 2), or none (step 1). */
async function openBooking(params: { package?: string; category?: string } = {}, opts = {}) {
  mockedParams.mockReturnValue(params);
  await renderScreen(<BookScreen />, opts);
}
const next = () => fireEvent.press(screen.getByTestId('next-step'));

describe('Booking, step by step', () => {
  test('step 1: tiles; one with two services asks which, then moves on by itself', async () => {
    await openBooking();
    expect(screen.getByTestId('booking-progress')).toHaveTextContent(/Step 1 of 3/);
    expect(screen.getAllByTestId(/^tile-/)).toHaveLength(8);
    await fireEvent.press(screen.getByTestId('tile-hourly'));
    expect(screen.getByText('Choose one')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('choice-3-hours-600'));
    expect(screen.getByTestId('booking-progress')).toHaveTextContent(/Step 2 of 3/);
    expect(screen.getByText('3 hours')).toBeOnTheScreen();
    // Back to change it.
    await fireEvent.press(screen.getByTestId('step-back'));
    expect(screen.getByTestId('choice-3-hours-600').props.accessibilityState).toMatchObject({
      checked: true,
    });
  });

  test('a step explains what is missing before moving on, and saves nothing', async () => {
    await openBooking({ package: 'night-driver' });
    await next();
    expect(screen.getByText('Please choose your city.')).toBeOnTheScreen();
    expect(screen.getByTestId('booking-progress')).toHaveTextContent(/Step 2 of 3/);
    await fireEvent.press(screen.getByTestId('city-Bhilai'));
    await fireEvent.changeText(screen.getByTestId('field-pickup'), 'Sector 6, Bhilai');
    await next();
    await fireEvent.press(screen.getByTestId('submit-booking'));
    expect(screen.getByText('Please tell us your name.')).toBeOnTheScreen();
    expect(screen.getByText('We need a mobile number to confirm your booking.')).toBeOnTheScreen();
    expect(mockedSubmit).not.toHaveBeenCalled();
  });

  test('a complete booking is saved and the customer is told we will call', async () => {
    mockedSubmit.mockResolvedValue({ ok: true, id: 'b1' });
    await openBooking({ package: 'night-driver' });
    await fireEvent.press(screen.getByTestId('city-Bhilai'));
    await fireEvent.changeText(screen.getByTestId('field-pickup'), 'Sector 6, Bhilai');
    await next();
    // Step 3 sums it all up before the customer books.
    expect(screen.getByTestId('booking-summary')).toHaveTextContent(/Night driver/);
    expect(screen.getByTestId('booking-summary')).toHaveTextContent(/Sector 6, Bhilai, Bhilai/);
    await fireEvent.changeText(screen.getByTestId('field-name'), 'Ravi Sharma');
    await fireEvent.changeText(screen.getByTestId('field-phone'), '98765 43210');
    await fireEvent.press(screen.getByTestId('submit-booking'));

    expect(mockedSubmit).toHaveBeenCalledWith(
      {
        name: 'Ravi Sharma',
        phone: '98765 43210',
        city: 'Bhilai',
        packageId: 'night-driver',
        destId: '',
        destOther: '',
        days: '',
        pickup: 'Sector 6, Bhilai',
        preferredTime: '',
        notes: '',
      },
      null,
      { pingUrl: '', trip: null, tripsLive: false },
    );
    expect(screen.getByText('Booking received!')).toBeOnTheScreen();
    expect(screen.getByText(/\+91 98765 43210/)).toBeOnTheScreen();
  });

  test('when saving fails, WhatsApp is offered with everything typed', async () => {
    mockedSubmit.mockResolvedValue({ ok: false, reason: 'network' });
    await openBooking({ package: '1-hour-300' });
    await fireEvent.press(screen.getByTestId('city-Raipur'));
    await fireEvent.changeText(screen.getByTestId('field-pickup'), 'Telibandha, Raipur');
    await next();
    await fireEvent.changeText(screen.getByTestId('field-name'), 'Ravi');
    await fireEvent.changeText(screen.getByTestId('field-phone'), '9876543210');
    await fireEvent.press(screen.getByTestId('submit-booking'));
    expect(screen.getByText(/Your connection dropped while saving/)).toBeOnTheScreen();
    expect(screen.getByTestId('failure-whatsapp')).toBeOnTheScreen();
  });

  test('a logged-in customer finds their details filled in and the booking tied to them', async () => {
    mockedSubmit.mockResolvedValue({ ok: true, id: 'b2' });
    const auth = {
      ...signedOut,
      user: { uid: 'uid-9', email: 'ravi@example.com' } as never,
      profile: { name: 'Ravi Sharma', phone: '9876543210', email: 'ravi@example.com' },
    };
    await openBooking({ package: '3-hours-600' }, { auth });
    await fireEvent.press(screen.getByTestId('city-Durg'));
    await fireEvent.changeText(screen.getByTestId('field-pickup'), 'Padmanabhpur, Durg');
    await next();
    expect(screen.getByTestId('field-name').props.value).toBe('Ravi Sharma');
    await fireEvent.press(screen.getByTestId('submit-booking'));
    expect(mockedSubmit.mock.calls[0][1]).toBe('uid-9');
    expect(screen.getByTestId('track-booking')).toBeOnTheScreen();
  });

  test('a one-way drop shows the estimate and saves the trip with it', async () => {
    mockedSubmit.mockResolvedValue({ ok: true, id: 'b3' });
    await openBooking({ package: 'one-way-drop' });
    await fireEvent.press(screen.getByTestId('city-Raipur'));
    expect(screen.getByText('Choose where you are going to see the estimate.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('dest-nagpur'));
    // Home by bus the same evening: one day covers it, no return charge.
    expect(screen.getByTestId('trip-estimate')).toHaveTextContent('₹1,450–1,650');
    expect(screen.getByText(/within the paid days/)).toBeOnTheScreen();

    // Delhi: still on the train 9 h after the 3 paid days (~22½ h by timetable) → 9 × ₹120.
    await fireEvent.press(screen.getByTestId('dest-delhi'));
    expect(screen.getByTestId('trip-estimate')).toHaveTextContent('₹5,430–6,030');
    expect(screen.getByText(/9 h after the last day/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('dest-nagpur'));

    // A day's stop on the way: one more driving day.
    await fireEvent.press(screen.getByTestId('days-plus'));
    expect(screen.getByTestId('days-value')).toHaveTextContent('2');
    expect(screen.getByTestId('trip-estimate')).toHaveTextContent('₹2,900–3,300');

    await fireEvent.changeText(screen.getByTestId('field-pickup'), 'Shankar Nagar, Raipur');
    await next();
    expect(screen.getByTestId('booking-summary')).toHaveTextContent(/Raipur → Nagpur · 2 days/);
    expect(screen.getByTestId('booking-summary')).toHaveTextContent(/₹2,900–3,300/);
    await fireEvent.changeText(screen.getByTestId('field-name'), 'Ravi Sharma');
    await fireEvent.changeText(screen.getByTestId('field-phone'), '9876543210');
    await fireEvent.press(screen.getByTestId('submit-booking'));
    const [input, , opts] = mockedSubmit.mock.calls[0];
    expect(input).toMatchObject({ packageId: 'one-way-drop', destId: 'nagpur', days: '2' });
    expect(opts.trip).toEqual({
      to: 'Nagpur',
      destId: 'nagpur',
      kind: 'one-way',
      km: 284,
      days: 2,
      returnHours: 0,
      estFrom: 2900,
      estTo: 3300,
    });
  });

  test('a trip needs a destination; a place not in the list is typed in', async () => {
    await openBooking({ package: 'outstation' });
    await fireEvent.press(screen.getByTestId('city-Durg'));
    await next();
    expect(screen.getByText('Please choose where you are going.')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByTestId('trip-search'), 'Jaipur');
    expect(screen.getByText(/Not in our list/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('dest-other'));
    expect(screen.getByTestId('trip-place').props.value).toBe('Jaipur');
    expect(screen.getByText(/We work out the distance and call you/)).toBeOnTheScreen();
  });

  test('a nearby place suggests the local full day', async () => {
    await openBooking({ package: 'outstation' });
    await fireEvent.press(screen.getByTestId('city-Raipur'));
    await fireEvent.changeText(screen.getByTestId('trip-search'), 'Bhil');
    await fireEvent.press(screen.getByTestId('dest-bhilai'));
    await fireEvent.press(screen.getByTestId('use-local'));
    expect(screen.queryByTestId('trip-section')).toBeNull();
    expect(screen.getByText('Full day in the city')).toBeOnTheScreen();
  });
});

describe('Account', () => {
  const signedIn = () => ({
    ...signedOut,
    user: { uid: 'u1', email: 'ravi@example.com' } as never,
    profile: { name: 'Ravi Sharma', phone: '9876543210', email: 'ravi@example.com' },
    deleteAccount: jest.fn(async () => 'deleted' as const),
  });

  test('signed out: says plainly when login is not switched on, and help is always there', async () => {
    await renderScreen(<AccountScreen />);
    expect(screen.getByText(/Login is not switched on in this version yet/)).toBeOnTheScreen();
    expect(screen.getAllByText('+91 91114 73929')).toHaveLength(2); // call and WhatsApp
  });

  test('signed in: the saved details are shown for editing', async () => {
    await renderScreen(<AccountScreen />, { auth: signedIn() });
    expect(screen.getByDisplayValue('Ravi Sharma')).toBeOnTheScreen();
    expect(screen.getByDisplayValue('+91 98765 43210')).toBeOnTheScreen();
  });

  test('deleting the account asks first, then deletes', async () => {
    const auth = signedIn();
    await renderScreen(<AccountScreen />, { auth });
    await fireEvent.press(screen.getByTestId('delete-account'));
    expect(auth.deleteAccount).not.toHaveBeenCalled();
    expect(screen.getByText('Delete your DriveBuddy account?')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('confirm-delete-account'));
    expect(auth.deleteAccount).toHaveBeenCalledTimes(1);
  });
});

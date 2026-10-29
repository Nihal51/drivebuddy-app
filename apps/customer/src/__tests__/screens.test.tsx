import { DEFAULT_CONFIG } from '@drivebuddy/shared';
import { fireEvent, screen } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import AccountScreen from '@/app/(tabs)/account';
import BookScreen from '@/app/book';
import BookingDetailScreen from '@/app/booking/[id]';
import HomeScreen from '@/app/(tabs)/index';
import { submitBooking, watchBooking } from '@/data/bookings';

import { renderScreen, signedOut } from './test-utils';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), dismissTo: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
  Stack: { Screen: () => null },
}));
jest.mock('@/data/bookings', () => ({ submitBooking: jest.fn(), watchBooking: jest.fn() }));
jest.mock('@/firebase/google', () => ({ isGoogleLoginAvailable: () => false }));

const mockedSubmit = submitBooking as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Home', () => {
  test('a hello from our driver, two big cards and every other service, with live prices', async () => {
    const config = { ...DEFAULT_CONFIG, prices: { ...DEFAULT_CONFIG.prices, oneHour: 350, threeHours: 650 } };
    await renderScreen(<HomeScreen />, { config });
    expect(screen.getByText('Your driver, at your door in 30 minutes')).toBeOnTheScreen();
    expect(screen.getByText('Welcome to DriveBuddy')).toBeOnTheScreen();
    // All eight services: hourly and drop as cards, the rest (monthly too) in the list.
    expect(screen.getAllByTestId(/^tile-/)).toHaveLength(8);
    expect(screen.getByTestId('tile-hourly')).toHaveTextContent(/from ₹350/);
    expect(screen.getByTestId('tile-drop')).toHaveTextContent(/₹1,550–1,650\/day/);
    expect(screen.getByTestId('tile-monthly')).toHaveTextContent(/Monthly driver.*from ₹16,000\/mo/);
    expect(screen.getByTestId('tile-hospital')).toHaveTextContent(/Priority/);
  });

  test('greets a logged-in customer by name', async () => {
    const auth = {
      ...signedOut,
      user: { uid: 'u1', email: 'ravi@example.com' } as never,
      profile: { name: 'Ravi Sharma', phone: '9876543210', email: 'ravi@example.com' },
    };
    await renderScreen(<HomeScreen />, { auth });
    expect(screen.getByText('Hello, Ravi')).toBeOnTheScreen();
  });

  test('a one-service card opens the details step; a two-service one opens the choice', async () => {
    await renderScreen(<HomeScreen />);
    await fireEvent.press(screen.getByTestId('tile-drop'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/book', params: { package: 'one-way-drop' } });
    await fireEvent.press(screen.getByTestId('tile-hourly'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/book', params: { category: 'hourly' } });
    await fireEvent.press(screen.getByTestId('tile-monthly'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/book', params: { category: 'monthly' } });
  });

  test('switches to Hindi', async () => {
    await renderScreen(<HomeScreen />);
    await fireEvent.press(screen.getByRole('radio', { name: 'हिंदी' }));
    expect(screen.getByText('आपका ड्राइवर, 30 मिनट में आपके दरवाज़े पर')).toBeOnTheScreen();
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
    // 6 h of driving: ₹600 for the first 3 h + 3 × ₹120; 6 h home × ₹120.
    expect(screen.getByTestId('trip-estimate')).toHaveTextContent('₹1,680');
    expect(screen.getByText(/6 h of driving: ₹600 for the first 3 h \+ 3 h × ₹120/)).toBeOnTheScreen();
    expect(screen.getByText(/Driver’s way home: 6 h from the drop/)).toBeOnTheScreen();
    expect(screen.getByTestId('trip-timeline')).toHaveTextContent(/Drops the car in Nagpur/);

    // Mumbai: 22 h of driving, 10 h left over is more than 7 = 2 full days; the typical
    // way home (the website looks up the trains); day and night drops the car sooner.
    await fireEvent.press(screen.getByTestId('dest-mumbai'));
    expect(screen.getByText(/2 driving days \(12 h each\)/)).toBeOnTheScreen();
    expect(screen.getByTestId('trip-estimate')).toHaveTextContent('₹4,300–4,500');
    expect(screen.getByTestId('trip-timeline')).toHaveTextContent(
      /Way home, typical time \(you book his ticket\)/,
    );
    await fireEvent.press(screen.getByTestId('trip-nonstop'));
    expect(screen.getByTestId('trip-timeline')).toHaveTextContent(/day and night/);
    await fireEvent.press(screen.getByTestId('trip-nonstop'));
    await fireEvent.press(screen.getByTestId('dest-nagpur'));

    // A day's stop on the way: two full days at the price up to 300 km (Nagpur, 284 km), the way home the same.
    await fireEvent.press(screen.getByTestId('days-plus'));
    expect(screen.getByTestId('days-value')).toHaveTextContent('2');
    expect(screen.getByTestId('trip-estimate')).toHaveTextContent('₹3,620–3,820');

    await fireEvent.changeText(screen.getByTestId('field-pickup'), 'Shankar Nagar, Raipur');
    await next();
    expect(screen.getByTestId('booking-summary')).toHaveTextContent(/Raipur → Nagpur · 2 days/);
    expect(screen.getByTestId('booking-summary')).toHaveTextContent(/₹3,620–3,820/);
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
      returnHours: 6,
      estFrom: 3620,
      estTo: 3820,
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

describe('Booking detail', () => {
  test('a finished one-way drop shows the trip times and the final bill', async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ id: 'b1' });
    (watchBooking as jest.Mock).mockImplementation((_id: string, onBooking: (b: unknown) => void) => {
      onBooking({
        id: 'b1',
        name: 'Ravi Sharma',
        phone: '9876543210',
        city: 'Raipur',
        packageId: 'one-way-drop',
        packageRaw: 'one-way-drop',
        pickup: 'Shankar Nagar',
        preferredTime: '2026-10-29T07:30',
        notes: '',
        status: 'completed',
        source: 'app',
        ref: 'DB-1042',
        trip: {
          to: 'Bengaluru',
          destId: 'bengaluru',
          kind: 'one-way',
          km: 1370,
          days: 2,
          returnHours: 38,
          estFrom: 5980,
          estTo: 6180,
        },
        clock: {
          startAt: new Date('2026-10-29T02:15:00Z'),
          dropAt: new Date('2026-10-30T07:10:00Z'),
          homeAt: new Date('2026-10-31T20:50:00Z'),
        },
        bill: {
          amount: 6200,
          dayRate: 1600,
          days: 2,
          extraHours: 5,
          extraHourRate: 120,
          extraCharge: 600,
          returnHours: 38,
          returnHourRate: 120,
          returnCharge: 2400,
          ticket: 0,
          nonstop: true,
        },
      });
      return () => {};
    });
    await renderScreen(<BookingDetailScreen />, {
      auth: { ...signedOut, ready: true, user: { uid: 'u1', email: 'ravi@example.com' } as never },
    });
    expect(screen.getByText('TRIP TIMES')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Driver left Thu, 29 Oct, 7:45 am · car dropped Fri, 30 Oct, 12:40 pm · driver home Sun, 1 Nov, 2:20 am',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText('FINAL BILL (FROM THE REAL TIMES)')).toBeOnTheScreen();
    expect(
      screen.getByText('₹6,200 (₹1,600 × 2 days + ₹600 for 5 extra hours + ₹2,400 way home (38 h))'),
    ).toBeOnTheScreen();
  });
});

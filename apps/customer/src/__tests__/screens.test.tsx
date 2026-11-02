import { DEFAULT_CONFIG } from '@drivebuddy/shared';
import { fireEvent, screen } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import AccountScreen from '@/app/(tabs)/account';
import BookScreen from '@/app/book';
import BookingDetailScreen from '@/app/booking/[id]';
import ProfileScreen from '@/app/profile';
import HomeScreen from '@/app/(tabs)/index';
import { submitBooking, watchBooking, watchMyBookings } from '@/data/bookings';

import { renderScreen, signedOut } from './test-utils';

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    dismissTo: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
  useLocalSearchParams: jest.fn(() => ({})),
  useFocusEffect: (effect: () => void) =>
    jest.requireActual<typeof import('react')>('react').useEffect(effect, [effect]),
  Stack: { Screen: () => null },
}));
jest.mock('@/data/bookings', () => ({
  submitBooking: jest.fn(),
  watchBooking: jest.fn(),
  watchMyBookings: jest.fn(() => () => {}),
}));
jest.mock('@/firebase/google', () => ({ isGoogleLoginAvailable: () => false }));

const mockedSubmit = submitBooking as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Home', () => {
  test('the dark top, the main card with live prices, and the other services', async () => {
    const config = { ...DEFAULT_CONFIG, prices: { ...DEFAULT_CONFIG.prices, oneHour: 350, threeHours: 650 } };
    await renderScreen(<HomeScreen />, { config });
    expect(screen.getByText('Where are we driving today?')).toBeOnTheScreen();
    expect(screen.getByText('Welcome to DriveBuddy')).toBeOnTheScreen();
    expect(screen.getByText('Driver in ~30 min')).toBeOnTheScreen();
    // The four main ways to book as tabs; one-way drop open, with popular places from Raipur.
    expect(screen.getAllByTestId(/^tab-/)).toHaveLength(4);
    expect(screen.getByTestId('tab-drop')).toBeSelected();
    expect(screen.getByText('POPULAR FROM RAIPUR')).toBeOnTheScreen();
    expect(screen.getByTestId('home-place-bilaspur')).toHaveTextContent(/Bilaspur.*from ₹960/);
    expect(screen.getByTestId('home-place-nagpur')).toHaveTextContent(/Nagpur.*from ₹1,700/);
    expect(screen.queryByTestId('home-place-raipur')).toBeNull();
    // By the hour: the two packages and their prices.
    await fireEvent.press(screen.getByTestId('tab-hourly'));
    expect(screen.getByTestId('home-package-1-hour-300')).toHaveTextContent(/₹350/);
    expect(screen.getByTestId('home-package-3-hours-600')).toHaveTextContent(/₹650/);
    // The other four services.
    expect(screen.getAllByTestId(/^tile-/)).toHaveLength(4);
    expect(screen.getByTestId('tile-monthly')).toHaveTextContent(/Monthly driver.*from ₹16,000\/mo/);
    expect(screen.getByTestId('tile-hospital')).toHaveTextContent(/Priority/);
    // Why DriveBuddy, without any "no surge" claim.
    expect(screen.getByTestId('home-trust')).toHaveTextContent(/Police-verified.*Pay after the trip/);
    expect(screen.queryByText(/surge/i)).toBeNull();
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

  test('every tap opens the booking with the pickup city, and the place tapped', async () => {
    await renderScreen(<HomeScreen />);
    await fireEvent.press(screen.getByTestId('home-city-Bhilai'));
    expect(screen.getByText('POPULAR FROM BHILAI')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('home-where-to'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/book',
      params: { package: 'one-way-drop', city: 'Bhilai' },
    });
    await fireEvent.press(screen.getByTestId('home-place-raipur'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/book',
      params: { package: 'one-way-drop', city: 'Bhilai', dest: 'raipur' },
    });
    await fireEvent.press(screen.getByTestId('tab-outstation'));
    await fireEvent.press(screen.getByTestId('home-place-korba'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/book',
      params: { package: 'outstation', city: 'Bhilai', dest: 'korba' },
    });
    await fireEvent.press(screen.getByTestId('tab-hourly'));
    await fireEvent.press(screen.getByTestId('home-book'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/book',
      params: { category: 'hourly', city: 'Bhilai' },
    });
    await fireEvent.press(screen.getByTestId('home-package-3-hours-600'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/book',
      params: { category: 'hourly', city: 'Bhilai', package: '3-hours-600' },
    });
    await fireEvent.press(screen.getByTestId('tile-monthly'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/book',
      params: { category: 'monthly', city: 'Bhilai' },
    });
    await fireEvent.press(screen.getByTestId('home-see-all'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/book', params: { city: 'Bhilai' } });
  });

  test('switches to Hindi', async () => {
    await renderScreen(<HomeScreen />);
    await fireEvent.press(screen.getByRole('radio', { name: 'हिंदी' }));
    expect(screen.getByText('आज कहाँ चलना है?')).toBeOnTheScreen();
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
async function openBooking(
  params: { package?: string; category?: string; city?: string; dest?: string } = {},
  opts = {},
) {
  mockedParams.mockReturnValue(params);
  await renderScreen(<BookScreen />, opts);
}
const next = () => fireEvent.press(screen.getByTestId('next-step'));

describe('Booking, step by step', () => {
  test('step 1: tiles; one with two services asks which, then moves on by itself', async () => {
    await openBooking();
    expect(screen.getByTestId('booking-progress')).toHaveTextContent(/Step 1 of 3/);
    expect(screen.getAllByTestId(/^tile-/)).toHaveLength(8);
    // Drops are priced by distance; outstation by the day, over every distance.
    expect(screen.getByTestId('tile-drop')).toHaveTextContent(/By distance/);
    expect(screen.getByTestId('tile-outstation')).toHaveTextContent(/₹1,300–1,650\/day/);
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
      { pingUrl: '', trip: null, tripsLive: false, pickupGeo: null },
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

  test('a place tapped on Home opens with the city and the place chosen, and the estimate', async () => {
    await openBooking({ package: 'one-way-drop', city: 'Raipur', dest: 'nagpur' });
    expect(screen.getByTestId('city-Raipur')).toBeChecked();
    expect(screen.getByTestId('trip-estimate')).toHaveTextContent('₹1,700');
  });

  test('the exact pickup spot: GPS or a pin on the map, sent with the booking (optional)', async () => {
    mockedSubmit.mockResolvedValue({ ok: true, id: 'b9' });
    await openBooking({ package: '3-hours-600', city: 'Raipur' });
    expect(screen.queryByTestId('pickup-pinned')).toBeNull();
    // GPS: the spot with its accuracy.
    await fireEvent.press(screen.getByTestId('pickup-locate'));
    expect(await screen.findByText('Location pinned (±15 m)')).toBeOnTheScreen();
    // The map opened; a pin moved by hand replaces it, without an accuracy.
    await fireEvent(screen.getByTestId('pickup-map'), 'onMessage', {
      nativeEvent: { data: JSON.stringify({ lat: 21.2501, lng: 81.6302 }) },
    });
    expect(screen.getByText('Location pinned on the map')).toBeOnTheScreen();
    // Nonsense from the map is ignored.
    await fireEvent(screen.getByTestId('pickup-map'), 'onMessage', {
      nativeEvent: { data: '{"lat":51.5,"lng":-0.1}' },
    });
    expect(screen.getByText('Location pinned on the map')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByTestId('field-pickup'), 'Shankar Nagar, near the temple');
    await next();
    await fireEvent.changeText(screen.getByTestId('field-name'), 'Ravi Sharma');
    await fireEvent.changeText(screen.getByTestId('field-phone'), '9876543210');
    await fireEvent.press(screen.getByTestId('submit-booking'));
    expect(mockedSubmit.mock.calls[0][2].pickupGeo).toEqual({ lat: 21.2501, lng: 81.6302 });
  });

  test('location turned off: the typed address is enough', async () => {
    const Location = jest.requireMock('expo-location') as { requestForegroundPermissionsAsync: jest.Mock };
    Location.requestForegroundPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });
    mockedSubmit.mockResolvedValue({ ok: true, id: 'b10' });
    await openBooking({ package: '3-hours-600', city: 'Raipur' });
    await fireEvent.press(screen.getByTestId('pickup-locate'));
    expect(await screen.findByText(/Location is off for DriveBuddy/)).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId('field-pickup'), 'Shankar Nagar, near the temple');
    await next();
    await fireEvent.changeText(screen.getByTestId('field-name'), 'Ravi Sharma');
    await fireEvent.changeText(screen.getByTestId('field-phone'), '9876543210');
    await fireEvent.press(screen.getByTestId('submit-booking'));
    expect(mockedSubmit.mock.calls[0][2].pickupGeo).toBeNull();
  });

  test('a city or place the app does not know is left for the customer to choose', async () => {
    await openBooking({ package: 'one-way-drop', city: 'Mumbai', dest: 'atlantis' });
    expect(screen.getByTestId('city-Raipur')).not.toBeChecked();
    expect(screen.queryByTestId('trip-estimate')).toBeNull();
  });

  test('a one-way drop shows the estimate and saves the trip with it', async () => {
    mockedSubmit.mockResolvedValue({ ok: true, id: 'b3' });
    await openBooking({ package: 'one-way-drop' });
    await fireEvent.press(screen.getByTestId('city-Raipur'));
    expect(screen.getByText('Choose where you are going to see the estimate.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('dest-nagpur'));
    // About 12 h away: one price for the route (1 Nov 2026) — at least ₹400 + ₹1,300; his way home included.
    expect(screen.getByTestId('trip-estimate')).toHaveTextContent('₹1,700');
    expect(screen.getByText('Route price — 12 h away (1 day): at least ₹400 + 1 × ₹1,300')).toBeOnTheScreen();
    expect(screen.getByText('Driver’s way home and waiting: 6 h, about 12 h away in all')).toBeOnTheScreen();
    expect(screen.getByText(/home more than 3 h after the plan: ₹120 an hour/)).toBeOnTheScreen();
    expect(screen.getByTestId('trip-timeline')).toHaveTextContent(/Drops the car in Nagpur/);

    // Mumbai: a route price; the typical way home (the website looks up the trains); day and night drops the car sooner.
    await fireEvent.press(screen.getByTestId('dest-mumbai'));
    // The route price: ₹350 + ₹4.5 × 1,118 km = ₹5,381 → ₹5,400 (was ₹4,300–4,500 by the hours).
    expect(screen.getByTestId('trip-estimate')).toHaveTextContent('₹5,400');
    expect(screen.getByText('Route price — 1,118 km: ₹350 + ₹4.5 a km')).toBeOnTheScreen();
    expect(screen.getByTestId('trip-timeline')).toHaveTextContent(
      /Way home, typical time \(you book his ticket\)/,
    );
    await fireEvent.press(screen.getByTestId('trip-nonstop'));
    expect(screen.getByTestId('trip-timeline')).toHaveTextContent(/day and night/);
    await fireEvent.press(screen.getByTestId('trip-nonstop'));
    await fireEvent.press(screen.getByTestId('dest-nagpur'));

    // A day's stop on the way: he is away 36 h — 2 days, so the route price is at least ₹400 + 2 × ₹1,300.
    await fireEvent.press(screen.getByTestId('days-plus'));
    expect(screen.getByTestId('days-value')).toHaveTextContent('2');
    expect(screen.getByTestId('trip-estimate')).toHaveTextContent('₹3,000');

    await fireEvent.changeText(screen.getByTestId('field-pickup'), 'Shankar Nagar, Raipur');
    await next();
    expect(screen.getByTestId('booking-summary')).toHaveTextContent(/Raipur → Nagpur · 2 days/);
    expect(screen.getByTestId('booking-summary')).toHaveTextContent(/₹3,000/);
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
      estFrom: 3000,
      estTo: 3000,
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
    expect(screen.getByText('+91 91114 73929 · 24 hours')).toBeOnTheScreen(); // call
    expect(screen.getByText('+91 91114 73929')).toBeOnTheScreen(); // WhatsApp
  });

  test('signed out: the login on the dark top, then preferences, help and more', async () => {
    await renderScreen(<AccountScreen />);
    expect(screen.getByText('Log in to see your bookings and get trip updates')).toBeOnTheScreen();
    expect(screen.getByText('Rate DriveBuddy on Google')).toBeOnTheScreen();
    expect(screen.queryByTestId('sign-out')).toBeNull();
    expect(screen.queryByTestId('delete-account')).toBeNull();
  });

  test('signed in: who is logged in, the booking numbers, and the account rows', async () => {
    (watchMyBookings as jest.Mock).mockImplementation((_uid: string, onData: (b: unknown[]) => void) => {
      onData([
        { id: 'a', status: 'assigned' },
        { id: 'b', status: 'completed' },
        { id: 'c', status: 'new' },
      ]);
      return () => {};
    });
    await renderScreen(<AccountScreen />, { auth: signedIn() });
    expect(screen.getByText('Ravi Sharma')).toBeOnTheScreen();
    expect(screen.getByText('+91 98765 43210')).toBeOnTheScreen();
    expect(screen.getByText('3')).toBeOnTheScreen(); // bookings
    expect(screen.getByText('2')).toBeOnTheScreen(); // active
    expect(screen.getByText('2 active now')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('edit-profile'));
    expect(router.push).toHaveBeenCalledWith('/profile');
  });

  test('notifications off: the row turns them on', async () => {
    const auth = signedIn();
    await renderScreen(<AccountScreen />, { auth });
    await fireEvent.press(screen.getByTestId('notifications-row'));
    expect(auth.enableNotifications).toHaveBeenCalledTimes(1);
  });

  test('personal details: the saved details are shown for editing, checked, saved, then back', async () => {
    const auth = signedIn();
    await renderScreen(<ProfileScreen />, { auth });
    expect(screen.getByDisplayValue('Ravi Sharma')).toBeOnTheScreen();
    expect(screen.getByDisplayValue('98765 43210')).toBeOnTheScreen(); // after the fixed +91
    expect(screen.getByTestId('profile-email').props.editable).toBe(false);
    await fireEvent.changeText(screen.getByTestId('profile-phone'), '12345');
    await fireEvent.press(screen.getByTestId('save-profile'));
    expect(auth.saveProfile).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByTestId('profile-phone'), '9876500000');
    await fireEvent.press(screen.getByTestId('save-profile'));
    expect(auth.saveProfile).toHaveBeenCalledWith({
      name: 'Ravi Sharma',
      phone: '9876500000',
      email: 'ravi@example.com',
    });
    expect(router.back).toHaveBeenCalled();
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

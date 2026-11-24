import { type City, DEFAULT_CONFIG, type ReturnOption, type TripPlan } from '@drivebuddy/shared';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Linking } from 'react-native';

import AccountScreen from '@/app/(tabs)/account';
import BookScreen from '@/app/book';
import BookingDetailScreen from '@/app/booking/[id]';
import ProfileScreen from '@/app/profile';
import HomeScreen from '@/app/(tabs)/index';
import type { ReturnTrains } from '@/booking/useReturnTrains';
import { submitBooking, watchBooking, watchMyBookings } from '@/data/bookings';
import { acceptPrice, ratedOnPhone, ratingState, submitRating } from '@/data/selfserve';

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
jest.mock('@/data/selfserve', () => ({
  acceptPrice: jest.fn(async () => ({ ok: true })),
  ratingState: jest.fn(async () => 'unknown'),
  submitRating: jest.fn(async () => 'ok'),
  ratedOnPhone: jest.fn(async () => null),
  rememberRated: jest.fn(async () => {}),
}));
jest.mock('@/firebase/google', () => ({ isGoogleLoginAvailable: () => false }));
// The trains home: the real hook (off without a lookup address), or a test's own answer.
const mockTrains: { answer?: (plan: TripPlan | null, startAt: number) => ReturnTrains } = {};
jest.mock('@/booking/useReturnTrains', () => {
  const actual = jest.requireActual<typeof import('@/booking/useReturnTrains')>('@/booking/useReturnTrains');
  return {
    ...actual,
    useReturnTrains: (plan: TripPlan | null, city: City | '', startAt: number) =>
      mockTrains.answer ? mockTrains.answer(plan, startAt) : actual.useReturnTrains(plan, city, startAt),
  };
});

const mockedSubmit = submitBooking as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  delete mockTrains.answer;
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
    // Priced by the driver's time (8 Nov 2026): Bilaspur a same-day drop, Nagpur one 24-hour block.
    expect(screen.getByTestId('home-place-bilaspur')).toHaveTextContent(/Bilaspur.*from ₹1,200/);
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
    // Drops are priced by the driver's time; outstation by the day, over every distance.
    expect(screen.getByTestId('tile-drop')).toHaveTextContent(/By the driver’s time/);
    expect(screen.getByTestId('tile-outstation')).toHaveTextContent(/₹1,050–1,750\/day/);
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

  test('12 hours in the city: offered with its price once the website lists it, hidden before', async () => {
    await openBooking({ category: 'hourly' });
    expect(screen.getByTestId('choice-3-hours-600')).toBeOnTheScreen();
    expect(screen.queryByTestId('choice-local-12-hours')).toBeNull();
    const config = { ...DEFAULT_CONFIG, prices: { ...DEFAULT_CONFIG.prices, twelveHours: 1400 } };
    await openBooking({ category: 'hourly' }, { config });
    expect(screen.getByTestId('choice-local-12-hours')).toHaveTextContent(/12 hours in the city/);
    expect(screen.getByTestId('choice-local-12-hours')).toHaveTextContent(/₹1,400/);
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

  test('the train home picked: his time to the hour, the hours past the 24-hour blocks ₹130 each (8 Nov 2026)', async () => {
    // Bengaluru: his train leaves 20 h after the drop, 26 h home.
    mockTrains.answer = (plan, startAt) => {
      const depart = startAt + ((plan?.dropAt ?? 0) + 20) * 3_600_000;
      const arrive = depart + 26 * 3_600_000;
      const option: ReturnOption = {
        id: `12296@${depart}`,
        legs: [
          {
            train: { number: '12296', name: 'Sanghamitra Exp' },
            from: { code: 'SBC', name: 'KSR Bengaluru' },
            to: { code: 'R', name: 'Raipur' },
            depart,
            arrive,
            checkedAt: depart - 86_400_000,
          },
        ],
        depart,
        arrive,
        expectedArrive: arrive,
        waitMinutes: 1200,
        totalMinutes: 46 * 60,
        scheduled: true,
        warnings: [],
      };
      return { status: 'ok', retrying: false, options: [option], selected: option, select: () => {} };
    };
    mockedSubmit.mockResolvedValue({ ok: true, id: 'b9' });
    await openBooking({ package: 'one-way-drop', dest: 'bengaluru' });
    await fireEvent.press(screen.getByTestId('city-Raipur'));
    // He drops the car 51.4 h after the start, waits 20 h and rides 26 h: home after 98 h —
    // 4 × 24 h × ₹1,750 = ₹7,000, and 2 h past them × ₹130 = ₹260.
    expect(screen.getByTestId('trip-estimate')).toHaveTextContent('₹7,260');
    expect(screen.getByTestId('trip-time-days')).toHaveTextContent(
      /4 × 24 h of the driver’s time × ₹1,750.*₹7,000/,
    );
    expect(screen.getByTestId('trip-time-past')).toHaveTextContent(
      /2 hours past the 96 h × ₹130 \(never more than one more day\).*₹260/,
    );
    expect(screen.getByTestId('trip-time-made-up')).toHaveTextContent(
      /His time: about 98 h.*driving about 27 h, then waiting 20 h and 26 h on the way home \(the train you picked\)/,
    );
    // The note tells the team the hours, for the same price on the call.
    await fireEvent.changeText(screen.getByTestId('field-pickup'), 'Shankar Nagar, Raipur');
    await next();
    await fireEvent.changeText(screen.getByTestId('field-name'), 'Ravi Sharma');
    await fireEvent.changeText(screen.getByTestId('field-phone'), '9876543210');
    await fireEvent.press(screen.getByTestId('submit-booking'));
    const [input, , opts] = mockedSubmit.mock.calls[0];
    expect(input.notes).toMatch(
      /Train home in the estimate: 12296 Sanghamitra Exp .*he waits 20 h in all; he is away \d+ h in all\)/,
    );
    expect(opts.trip).toMatchObject({ destId: 'bengaluru', estFrom: 7260, estTo: 7260 });
  });

  test('past 160 km with the website’s outstation.oneWay: driving days, his way home, his ticket; Check seats', async () => {
    // Raipur → Ranchi: his train leaves 1 h after the drop and gets him home 9 h 40 min later.
    mockTrains.answer = (plan, startAt) => {
      const depart = startAt + ((plan?.dropAt ?? 0) + 1) * 3_600_000;
      const arrive = depart + (9 * 60 + 40) * 60_000;
      const option: ReturnOption = {
        id: `18310@${depart}`,
        legs: [
          {
            train: { number: '18310', name: 'Hatia Sambalpur Exp' },
            from: { code: 'RNC', name: 'Ranchi' },
            to: { code: 'R', name: 'Raipur' },
            depart,
            arrive,
            checkedAt: depart - 86_400_000,
          },
        ],
        depart,
        arrive,
        expectedArrive: arrive,
        waitMinutes: 60,
        totalMinutes: 10 * 60 + 40,
        scheduled: true,
        warnings: [],
      };
      return { status: 'ok', retrying: false, options: [option], selected: option, select: () => {} };
    };
    const config = {
      ...DEFAULT_CONFIG,
      outstation: {
        ...DEFAULT_CONFIG.outstation,
        oneWay: {
          driveDay: 1600,
          returnDay: 1600,
          returnHour: 160,
          driveHoursPerDay: 12,
          driveGraceHours: 1,
        },
      },
    };
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    mockedSubmit.mockResolvedValue({ ok: true, id: 'b11' });
    await openBooking({ package: 'one-way-drop', city: 'Raipur', dest: 'ranchi' }, { config });
    expect(screen.getByTestId('trip-estimate')).toHaveTextContent('₹3,200');
    expect(screen.getByTestId('trip-long-driving')).toHaveTextContent(
      /1 driving day \(about 12 h\) × ₹1,600.*₹1,600/,
    );
    expect(screen.getByTestId('trip-long-home')).toHaveTextContent(
      /His way home about 10 h 40 min \(waiting 1 h \+ train 9 h 40 min\): 11 h × ₹160 \(never more than ₹1,600 a day\).*₹1,600/,
    );
    expect(screen.getByTestId('trip-long-ticket')).toHaveTextContent(
      /His ticket home: you book and pay for it.*\+ ticket/,
    );
    expect(screen.queryByTestId('trip-time-days')).toBeNull();
    // The trains: the sell-out note above them, and Check seats on each.
    expect(screen.getByTestId('seats-note')).toHaveTextContent(
      /Tickets can sell out — check seats before you book/,
    );
    await fireEvent.press(screen.getByTestId(/^seats-18310@/));
    expect(open).toHaveBeenCalledWith('https://www.ixigo.com/trains/18310/seat-availability');
    open.mockRestore();
    // Saved as the website saves it: the driving days and the estimate.
    await fireEvent.changeText(screen.getByTestId('field-pickup'), 'Shankar Nagar, Raipur');
    await next();
    await fireEvent.changeText(screen.getByTestId('field-name'), 'Ravi Sharma');
    await fireEvent.changeText(screen.getByTestId('field-phone'), '9876543210');
    await fireEvent.press(screen.getByTestId('submit-booking'));
    expect(mockedSubmit.mock.calls[0][2].trip).toMatchObject({
      destId: 'ranchi',
      days: 1,
      estFrom: 3200,
      estTo: 3200,
    });
  });

  test('a one-way drop shows the estimate and saves the trip with it', async () => {
    mockedSubmit.mockResolvedValue({ ok: true, id: 'b3' });
    await openBooking({ package: 'one-way-drop' });
    await fireEvent.press(screen.getByTestId('city-Raipur'));
    expect(screen.getByText('Choose where you are going to see the estimate.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('dest-nagpur'));
    // About 13 h away (6 h driving, the route's average 2.5 h wait and 4.75 h home): one 24-hour block, ₹1,700.
    expect(screen.getByTestId('trip-estimate')).toHaveTextContent('₹1,700');
    expect(screen.getByText(/the driver is away about 13 h/)).toBeOnTheScreen();
    expect(screen.getByTestId('trip-time-days')).toHaveTextContent(
      /1 × 24 h of the driver’s time × ₹1,700.*₹1,700/,
    );
    expect(screen.queryByTestId('trip-time-past')).toBeNull();
    expect(screen.getByTestId('trip-time-made-up')).toHaveTextContent(
      'His time: about 13 h, from when he leaves until he is home — driving about 6 h, then waiting 2 h 30 min and 4 h 45 min on the way home (the route’s average). 11 h to spare in the 24 h: a delay costs nothing until thenIncluded',
    );
    expect(screen.getByTestId('trip-explainer')).toHaveTextContent(
      /One rule: the driver’s time.*Up to 160 km he is home the same day: one price for the trip \(₹1,050–1,350, by distance\)\. Farther: ₹1,700 for each 24 hours.*Past the 24-hour blocks, ₹130 an hour/,
    );
    expect(screen.getByTestId('trip-timeline')).toHaveTextContent(/Drops the car in Nagpur/);

    // Bilaspur: home the same day — one price for the trip.
    await fireEvent.press(screen.getByTestId('dest-bilaspur'));
    expect(screen.getByTestId('trip-estimate')).toHaveTextContent('₹1,200');
    expect(screen.getByTestId('trip-time-days')).toHaveTextContent(
      /One price for the trip — 113 km, he is home the same day/,
    );

    // Mumbai: 57 h = 2 × 24 h + 9 h × ₹130; the route's average way home; day and night drops the car sooner.
    await fireEvent.press(screen.getByTestId('dest-mumbai'));
    expect(screen.getByTestId('trip-estimate')).toHaveTextContent('₹4,670');
    expect(screen.getByTestId('trip-time-past')).toHaveTextContent(/9 hours past the 48 h × ₹130.*₹1,170/);
    expect(screen.getByTestId('trip-timeline')).toHaveTextContent(
      /Way home, the route’s average \(you book his ticket\)/,
    );
    await fireEvent.press(screen.getByTestId('trip-nonstop'));
    expect(screen.getByTestId('trip-timeline')).toHaveTextContent(/day and night/);
    await fireEvent.press(screen.getByTestId('trip-nonstop'));
    await fireEvent.press(screen.getByTestId('dest-nagpur'));

    // A day's stop on the way: he is away 37 h — 24 h + 13 h × ₹130 (₹1,690, under a day).
    await fireEvent.press(screen.getByTestId('days-plus'));
    expect(screen.getByTestId('days-value')).toHaveTextContent('2');
    expect(screen.getByTestId('trip-estimate')).toHaveTextContent('₹3,390');

    await fireEvent.changeText(screen.getByTestId('field-pickup'), 'Shankar Nagar, Raipur');
    await next();
    expect(screen.getByTestId('booking-summary')).toHaveTextContent(/Raipur → Nagpur · 2 days/);
    expect(screen.getByTestId('booking-summary')).toHaveTextContent(/₹3,390/);
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
      returnHours: 8,
      estFrom: 3390,
      estTo: 3390,
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

  describe('without a call', () => {
    const DRIVER = { id: 'd1', name: 'Suresh', phone: '9876500000' };
    const BASE = {
      id: 'b2',
      name: 'Ravi Sharma',
      phone: '9876543210',
      city: 'Raipur',
      packageId: 'one-way-drop',
      packageRaw: 'one-way-drop',
      pickup: 'Shankar Nagar',
      preferredTime: '2026-11-29T07:30',
      notes: '',
      status: 'new',
      source: 'app',
      ref: 'DB-1043',
      customerUid: 'u1',
      trip: {
        to: 'Nagpur',
        destId: 'nagpur',
        kind: 'one-way',
        km: 284,
        days: 1,
        returnHours: 8,
        estFrom: 1700,
        estTo: 1700,
      },
    };
    const auth = { ...signedOut, ready: true, user: { uid: 'u1', email: 'ravi@example.com' } as never };
    const show = async (booking: Record<string, unknown>) => {
      (useLocalSearchParams as jest.Mock).mockReturnValue({ id: booking.id });
      (watchBooking as jest.Mock).mockImplementation((_id: string, onBooking: (b: unknown) => void) => {
        onBooking(booking);
        return () => {};
      });
      await renderScreen(<BookingDetailScreen />, { auth });
    };

    describe('live fare while the driver is on the job', () => {
      const START = Date.parse('2026-11-24T04:00:00Z');
      beforeEach(() => jest.useFakeTimers({ now: START + (9 * 60 + 20) * 60_000 }));
      afterEach(() => jest.useRealTimers());

      test('a local job: time with the driver, so far ₹X with its breakdown, ticking on', async () => {
        await show({
          ...BASE,
          packageId: '3-hours-600',
          packageRaw: '3-hours-600',
          trip: undefined,
          status: 'assigned',
          clock: { startAt: new Date(START) },
        });
        // 9 h 20 min: 10 hours used (the 10th is past its 15 minutes), 7 past the package.
        expect(screen.getByText('Driver with you 9 h 20 min · so far ₹1,440')).toBeOnTheScreen();
        expect(screen.getByText('₹600 package (3 h) + 7 extra hours × ₹120')).toBeOnTheScreen();
        expect(screen.getByText('Final bill when the job ends.')).toBeOnTheScreen();
        await act(async () => {
          jest.advanceTimersByTime(60_000);
        });
        expect(screen.getByText('Driver with you 9 h 21 min · so far ₹1,440')).toBeOnTheScreen();
      });

      test('a trip: time on the trip and the estimate — from his real time once longer than booked', async () => {
        await show({ ...BASE, status: 'assigned', clock: { startAt: new Date(START) } });
        expect(screen.getByText('On the trip for 9 h 20 min · estimate ₹1,700')).toBeOnTheScreen();
        jest.setSystemTime(START + 28 * 60 * 60_000);
        await act(async () => {
          jest.advanceTimersByTime(30_000);
        });
        expect(screen.getByText('On the trip for 1 day 4 h · estimate ₹2,220')).toBeOnTheScreen();
        expect(
          screen.getByText("Longer than booked: the driver's time is priced as in the estimate."),
        ).toBeOnTheScreen();
      });

      test('no start time yet, or not on the job: no meter', async () => {
        await show({ ...BASE, status: 'assigned' });
        expect(screen.queryByTestId('fare-meter')).toBeNull();
        await show({ ...BASE, status: 'confirmed', clock: { startAt: new Date(START) } });
        expect(screen.queryByTestId('fare-meter')).toBeNull();
      });
    });

    test('the customer accepts the trip estimate with one tap', async () => {
      await show(BASE);
      await fireEvent.press(screen.getByText('Accept price ₹1,700'));
      expect(acceptPrice).toHaveBeenCalledWith('b2', 1700);
    });

    test('someone else’s booking, or one already accepted, has no Accept button', async () => {
      await show({ ...BASE, customerUid: 'u2' });
      expect(screen.queryByTestId('accept-price')).toBeNull();
      await show({ ...BASE, acceptedPrice: { amount: 1700 } });
      expect(screen.queryByTestId('accept-price')).toBeNull();
      expect(screen.getByText('Price accepted ✓ — we’re finding your driver')).toBeOnTheScreen();
      expect(screen.getByText('PRICE YOU ACCEPTED')).toBeOnTheScreen();
    });

    test('confirmed by the robot: confirmed instantly, finding the driver', async () => {
      await show({
        ...BASE,
        packageId: '3-hours-600',
        trip: undefined,
        status: 'confirmed',
        updatedBy: 'robot',
      });
      expect(
        screen.getByText('Confirmed instantly — no call needed. We are finding your driver.'),
      ).toBeOnTheScreen();
      expect(screen.getByText('Finding your driver…')).toBeOnTheScreen();
    });

    test('a local bill and its Razorpay link: Pay opens only that link', async () => {
      const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
      await show({
        ...BASE,
        packageId: '3-hours-600',
        trip: undefined,
        status: 'completed',
        localBill: { amount: 900, baseHours: 3, usedHours: 5, extraHours: 2, extraHourRate: 150 },
        payment: { status: 'pending', amount: 900, url: 'https://rzp.io/i/AbC123' },
      });
      expect(
        screen.getByText('₹900 (₹600 package (3 h) + 2 extra hours × ₹150 · 5 h with the driver)'),
      ).toBeOnTheScreen();
      await fireEvent.press(screen.getByText('Pay ₹900'));
      expect(open).toHaveBeenCalledWith('https://rzp.io/i/AbC123');
      open.mockRestore();
    });

    test('a link that is not Razorpay is never offered; paid shows Paid ✓', async () => {
      await show({
        ...BASE,
        status: 'completed',
        payment: { status: 'pending', amount: 900, url: 'https://evil.example/pay' },
      });
      expect(screen.queryByTestId('pay')).toBeNull();
      expect(screen.getByText('We have sent the payment link to your mobile by SMS.')).toBeOnTheScreen();
      await show({
        ...BASE,
        status: 'completed',
        payment: { status: 'paid', amount: 900, url: 'https://rzp.io/i/x' },
      });
      expect(screen.getByText('Paid ₹900 ✓')).toBeOnTheScreen();
    });

    test('a UPI link: Pay ₹X by UPI opens it; no UPI app → pay the driver or scan the QR', async () => {
      const upi = 'upi://pay?pa=drivebuddy%40ybl&pn=DriveBuddy&am=750.00&cu=INR&tn=DB-1042';
      const open = jest.spyOn(Linking, 'openURL').mockResolvedValueOnce(true);
      await show({
        ...BASE,
        status: 'completed',
        payment: { status: 'pending', method: 'upi', amount: 750, url: upi },
      });
      await fireEvent.press(screen.getByText('Pay ₹750 by UPI'));
      expect(open).toHaveBeenCalledWith(upi);
      expect(screen.queryByText("No UPI app found — pay the driver or scan DriveBuddy's QR")).toBeNull();
      open.mockRejectedValueOnce(new Error('No Activity found to handle Intent'));
      await fireEvent.press(screen.getByText('Pay ₹750 by UPI'));
      expect(
        await screen.findByText("No UPI app found — pay the driver or scan DriveBuddy's QR"),
      ).toBeOnTheScreen();
      open.mockRestore();
    });

    test('a lookalike UPI link never opens; paid by the driver says how', async () => {
      await show({
        ...BASE,
        status: 'completed',
        payment: { status: 'pending', method: 'upi', amount: 750, url: 'upi://payx?pa=thief@ybl' },
      });
      expect(screen.queryByTestId('pay')).toBeNull();
      expect(
        screen.getByText("Pay the driver in cash, or scan DriveBuddy's QR he shows you."),
      ).toBeOnTheScreen();
      await show({
        ...BASE,
        status: 'completed',
        payment: { status: 'paid', method: 'cash', amount: 750, by: 'driver' },
      });
      expect(screen.getByText('Paid ₹750 in cash ✓')).toBeOnTheScreen();
      await show({
        ...BASE,
        status: 'completed',
        payment: { status: 'paid', method: 'upi', amount: 750, by: 'driver' },
      });
      expect(screen.getByText('Paid ₹750 ✓ · UPI')).toBeOnTheScreen();
    });

    test('rating the driver: 5 stars, a comment, then the Google review link', async () => {
      await show({ ...BASE, status: 'completed', assignedDriver: DRIVER });
      expect(await screen.findByText('How was Suresh?')).toBeOnTheScreen();
      expect(ratingState).toHaveBeenCalledWith('b2');
      await fireEvent.press(screen.getByTestId('star-5'));
      await fireEvent.changeText(screen.getByLabelText('Anything to tell us?'), 'On time, drove well');
      await fireEvent.press(screen.getByTestId('send-rating'));
      expect(submitRating).toHaveBeenCalledWith('b2', 5, 'On time, drove well', 'd1', 'u1');
      expect(await screen.findByText('Thanks for your rating!')).toBeOnTheScreen();
      expect(screen.getByTestId('google-review')).toBeOnTheScreen();
    });

    test('a refused rating reads as already rated, with no Google ask', async () => {
      (submitRating as jest.Mock).mockResolvedValueOnce('already');
      await show({ ...BASE, status: 'completed', assignedDriver: DRIVER });
      await fireEvent.press(await screen.findByTestId('star-3'));
      await fireEvent.press(screen.getByTestId('send-rating'));
      expect(await screen.findByText('Thanks, already rated')).toBeOnTheScreen();
      expect(screen.queryByTestId('google-review')).toBeNull();
    });

    test('rated before on this phone: just thanks', async () => {
      (ratedOnPhone as jest.Mock).mockResolvedValueOnce(4);
      await show({ ...BASE, status: 'completed', assignedDriver: DRIVER });
      expect(await screen.findByText('Thanks for your rating!')).toBeOnTheScreen();
      expect(ratingState).not.toHaveBeenCalled();
      expect(screen.queryByTestId('google-review')).toBeNull();
    });
  });
});

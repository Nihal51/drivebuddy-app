/**
 * Every word the app shows, in English. hi.ts must have the same shape — the
 * type checker refuses a Hindi file with a missing or extra line, so a screen
 * can never show an empty label in one language.
 *
 * Wording follows the website (thedrivebuddy.in) so customers see the same
 * promises in both places.
 */

import type { BookingStatus, City, PackageId } from '@drivebuddy/shared';

export const en = {
  locale: 'en-IN',
  languageName: 'English',

  common: {
    appName: 'DriveBuddy',
    call: 'Call',
    whatsapp: 'WhatsApp',
    email: 'Email',
    book: 'Book',
    bookDriver: 'Book a driver',
    retry: 'Try again',
    save: 'Save',
    saved: 'Saved',
    cancel: 'Cancel',
    done: 'Done',
    back: 'Back',
    optional: 'optional',
    loading: 'Loading…',
    offline: 'You are offline. Prices shown are the last ones we loaded.',
  },

  tabs: {
    home: 'Home',
    bookings: 'My bookings',
    account: 'Account',
  },

  cities: { Raipur: 'Raipur', Bhilai: 'Bhilai', Durg: 'Durg', Bilaspur: 'Bilaspur' } satisfies Record<
    City,
    string
  >,

  home: {
    greeting: (name: string) => `Hello, ${name}`,
    title: 'A verified driver for your car',
    subtitle:
      'Police-verified, sober drivers with 5+ years of experience. Usually at your door within 30 minutes.',
    cities: 'Raipur · Bhilai · Durg · Bilaspur',
    startingFrom: (price: string) => `Drivers from ${price}`,
    pricesTitle: 'Services and prices',
    pricesNote: 'Driver charges only — your car, your fuel. No surge pricing, no hidden charges.',
    groups: {
      hourly: 'By the hour',
      day: 'Full day and trips',
      monthly: 'Monthly driver',
      special: 'Hospital, weddings and drops',
    },
    trustTitle: 'Why families trust DriveBuddy',
    helpTitle: 'Rather talk to us?',
    helpBody: 'Call or WhatsApp — we answer 24/7.',
    monthlyNote: (hours: number, daysOff: number) =>
      `${hours} hours a day · ${daysOff} days off a month · replacement driver if yours is away`,
  },

  packages: {
    '1-hour-300': { name: '1 hour', blurb: 'A meeting, an errand, a quick hospital visit' },
    '3-hours-600': { name: '3 hours', blurb: 'Shopping, family visits, airport runs' },
    'local-full-day': { name: 'Full day in the city', blurb: '8 hours of driving within your city' },
    outstation: { name: 'Outstation trip', blurb: 'Out of town in your own car, by the day' },
    'night-driver': { name: 'Night driver', blurb: '8 PM – 6 AM, for late returns and parties' },
    'medical-emergency': { name: 'Hospital / emergency', blurb: 'Priority booking — we call you first' },
    'monthly-basic': { name: 'Monthly driver — Basic', blurb: 'Your own regular driver every month' },
    'monthly-premium': {
      name: 'Monthly driver — Premium',
      blurb: 'Lower joining fee, free stand-in when your driver is away',
    },
    'wedding-event': { name: 'Wedding / event', blurb: 'Drivers, or cars with drivers, for the whole event' },
    'one-way-drop': { name: 'One-way car drop', blurb: 'We drive your car to another city, by the day' },
  } satisfies Record<PackageId, { name: string; blurb: string }>,
  unknownPackage: 'Driver booking',
  popular: 'Most popular',

  price: {
    from: (amount: string) => `from ${amount}`,
    monthly: (amount: string) => `${amount}/month`,
    perDay: (amount: string) => `${amount}/day`,
    priority: 'Priority',
    quote: 'Quote on call',
  },

  pillars: [
    {
      icon: 'shield-checkmark',
      title: 'Police verified',
      body: 'ID and police background check on every driver.',
    },
    { icon: 'ban', title: 'Zero alcohol', body: 'Breathalyser test before every shift.' },
    { icon: 'ribbon', title: 'Trained', body: 'Defensive driving, first aid and customer care.' },
    { icon: 'time', title: '5+ years', body: 'Every driver has at least five years behind the wheel.' },
  ] as { icon: 'shield-checkmark' | 'ban' | 'ribbon' | 'time'; title: string; body: string }[],

  book: {
    title: 'Book a driver',
    lede: 'Fill this in and we call you back within minutes to confirm your driver.',
    loggedInAs: (name: string) => `Booking as ${name}. It will appear in My bookings.`,
    loginHint: 'Log in to track this booking and get a notification when your driver is assigned.',
    loginLink: 'Log in',
    name: 'Your name',
    namePlaceholder: 'Full name',
    phone: 'Mobile number',
    phonePlaceholder: '10-digit mobile number',
    city: 'City',
    service: 'Service',
    pickup: 'Pickup address',
    pickupPlaceholder: 'House / street, area, landmark',
    when: 'When',
    asap: 'As soon as possible',
    schedule: 'Pick a time',
    today: 'Today',
    tomorrow: 'Tomorrow',
    noSlotsToday: 'No more slots today — pick tomorrow, or choose “As soon as possible”.',
    notes: 'Anything else?',
    notesPlaceholder: 'Car model, destination, number of hours…',
    submit: 'Book driver',
    submitting: 'Booking…',
    fixErrors: 'Please check the highlighted fields.',
    disclaimer: 'No payment now. We confirm the price with you on the call.',
  },

  trip: {
    whereRound: 'Where to?',
    whereOneWay: 'Drop the car in',
    search: 'Search a city or town',
    elsewhere: 'Somewhere else',
    noMatch: 'Not in our list — choose “Somewhere else”.',
    place: 'City or town',
    placePlaceholder: 'e.g. Jaipur',
    daysRound: 'Days of the trip',
    daysOneWay: 'Driving days',
    daysHint: (min: number) => `At least ${min} for this distance — add days to stay or stop on the way.`,
    daysHintUnknown: 'How many days you need the driver.',
    fewer: 'One day less',
    more: 'One day more',
    estimateTitle: 'Estimated price',
    route: (from: string, to: string, km: string) => `${from} → ${to} · about ${km} one way`,
    km: (n: string) => `${n} km`,
    days: (n: number) => (n === 1 ? '1 day' : `${n} days`),
    returnHours: (n: number) => `${n} h for the driver to get home`,
    homeLate: (n: number) => `Driver still on his way home ${n} h after the last day`,
    homeInTime: 'Driver’s bus/train home: within the paid days',
    noCharge: 'No charge',
    returnMax: (rate: string, max: string) => `${rate}/h, max ${max} a day`,
    returnShort: (n: number) => `return (${n} h)`,
    times: (what: string, rate: string) => `${what} × ${rate}`,
    chooseCity: 'Choose your city above to see the estimate.',
    chooseDest: 'Choose where you are going to see the estimate.',
    elsewhereNote: (rate: string) => `We work out the distance and call you with the price: ${rate} a day.`,
    elsewhereReturn: (rate: string, max: string) =>
      `His way home is included, unless he is still travelling after the last day: ${rate} an hour, max ${max} a day.`,
    sameCity: 'That is your pickup city — for driving around town, choose a local package.',
    localTip: (place: string, km: string, price: string) =>
      `${place} is only about ${km} away — a full day in the city (${price}) usually costs less.`,
    useLocal: 'Switch to full day',
    smallPrint: (hours: number, extra: string, meal: string, oneWay: boolean) =>
      `An estimate: we confirm the exact price on the call, before the driver leaves. Each day covers the driver’s 24 hours from the start, with up to ${hours} hours of driving (${extra} an hour beyond)${oneWay ? ' and his way home' : ''}. Fuel, tolls and parking${oneWay ? ', and his bus or train ticket,' : ''} are extra. Please give the driver his meals, or ${meal} a day.`,
    summaryRound: 'round trip',
    summaryOneWay: 'one-way drop',
    estimate: (range: string) => `estimate ${range}`,
    priceOnCall: 'price on the call',
    extraHours: (n: number) => (n === 1 ? '1 extra hour' : `${n} extra hours`),
    ticket: (amount: string) => `${amount} ticket`,
  },

  success: {
    title: 'Booking received!',
    body: (phone: string) => `We will call you on ${phone} within a few minutes to confirm your driver.`,
    track: 'Track this booking',
    guestTip: 'Log in next time to track your bookings here and get driver updates.',
    another: 'Book another driver',
    home: 'Back to home',
  },

  failure: {
    title: 'We could not save your booking',
    config:
      'Online booking is not connected in this version yet. Send your details on WhatsApp and we confirm right away.',
    permission:
      'We could not save your request just now. Please send it on WhatsApp or call us — we pick it up immediately.',
    network:
      'Your connection dropped while saving. Check your internet, or send the details on WhatsApp instead.',
    timeout:
      'This is taking too long — your internet may be slow. It may still go through; to be safe, send it on WhatsApp too.',
    unknown:
      'Something went wrong while saving. Please send it on WhatsApp or call us — we do not want you waiting.',
    sendWhatsapp: 'Send on WhatsApp',
  },

  whatsappBooking: {
    intro: 'Hi DriveBuddy, I would like to book a driver.',
    name: 'Name',
    mobile: 'Mobile',
    city: 'City',
    service: 'Service',
    pickup: 'Pickup',
    when: 'Preferred time',
    notes: 'Notes',
    trip: 'Trip',
  },

  errors: {
    name: {
      required: 'Please tell us your name.',
      tooShort: 'Please enter your full name.',
      tooLong: 'Please keep your name under 60 characters.',
    },
    phone: {
      required: 'We need a mobile number to confirm your booking.',
      invalidMobile: 'Enter a 10-digit mobile number so we can call you back.',
    },
    city: { required: 'Please choose your city.' },
    packageId: { required: 'Please choose a service.' },
    destId: { required: 'Please choose where you are going.' },
    destOther: {
      required: 'Type the city or town you are going to.',
      tooShort: 'Type the city or town you are going to.',
      tooLong: 'Please keep the place name under 60 characters.',
    },
    days: { invalidNumber: 'Choose between 1 and 60 days.' },
    pickup: {
      required: 'Enter a pickup address so the driver knows where to reach you.',
      tooShort: 'Please add a little more detail — area or landmark helps.',
      tooLong: 'Please keep the address under 300 characters.',
    },
    notes: { tooLong: 'Please keep this under 500 characters.' },
    preferredTime: {
      required: 'Please pick a time, or choose “As soon as possible”.',
      tooLong: 'Please pick the time again.',
    },
    generic: 'Please check this field.',
  },

  status: {
    new: { label: 'Received', detail: 'We will call you shortly to confirm.' },
    confirmed: { label: 'Confirmed', detail: 'Your booking is confirmed. We are choosing your driver.' },
    assigned: { label: 'Driver assigned', detail: 'Your driver’s details are below.' },
    completed: { label: 'Completed', detail: 'Thank you for choosing DriveBuddy.' },
    cancelled: { label: 'Cancelled', detail: 'This booking was cancelled.' },
  } satisfies Record<BookingStatus, { label: string; detail: string }>,

  bookings: {
    title: 'My bookings',
    current: 'Current',
    past: 'Past',
    empty: 'No bookings yet',
    emptyBody: 'Bookings you make while logged in show up here, with live status.',
    signedOutTitle: 'See all your bookings',
    signedOutBody: 'Log in to follow each booking live and get a notification when your driver is assigned.',
    guestNote: 'Booked without logging in? Don’t worry — we call you on the number you gave.',
    numbering: 'Numbering…',
    asap: 'As soon as possible',
    loadError: 'Could not load your bookings. Pull down to try again.',
  },

  detail: {
    title: 'Booking',
    reference: 'Reference',
    when: 'When',
    pickup: 'Pickup',
    city: 'City',
    notes: 'Notes',
    trip: 'Trip',
    price: 'Agreed price',
    bookedOn: 'Booked on',
    yourDriver: 'Your driver',
    callDriver: 'Call driver',
    cancelReason: (reason: string) => `Reason: ${reason}`,
    help: 'Questions about this booking?',
    helpMessage: (ref: string) => `Hi DriveBuddy, about my booking ${ref}: `,
    notFound: 'We could not find this booking.',
    reviewTitle: 'Happy with your driver?',
    reviewBody: 'A Google review helps other families find a driver they can trust.',
    reviewButton: 'Write a review',
  },

  account: {
    title: 'Account',
    signedOutTitle: 'Log in to DriveBuddy',
    benefits: [
      'Follow every booking live',
      'A notification when your driver is assigned',
      'Faster booking — your details are filled in',
    ],
    google: 'Continue with Google',
    signingIn: 'Signing in…',
    loginUnavailable:
      'Login is not switched on in this version yet. You can still book — we call you to confirm.',
    profile: 'Your details',
    profileHint: 'Used to fill in your bookings.',
    signOut: 'Log out',
    notifications: 'Booking updates',
    notificationsOn: 'On — we notify you when your booking is confirmed or a driver is assigned.',
    notificationsOff: 'Off',
    notificationsTurnOn: 'Turn on',
    notificationsDenied: 'Blocked in your phone settings.',
    openSettings: 'Open settings',
    notificationsUnavailable: 'Not available on this device.',
    language: 'Language',
    help: 'Help and information',
    website: 'Website',
    privacy: 'Privacy policy',
    terms: 'Terms of service',
    version: (v: string) => `Version ${v}`,
    statsTitle: 'Anonymous usage stats',
    statsBody: 'Helps us improve the app. No names, numbers or addresses are ever sent.',
    deleteLink: 'Delete my account',
    deleteTitle: 'Delete your DriveBuddy account?',
    deleteBody:
      'This removes your login, your saved name and number, and notifications on your phones. Past bookings stay in our records for accounts and safety, no longer linked to a login. You can still book as a guest any time.',
    deleteConfirm: 'Yes, delete my account',
    deleteFailed:
      'Could not delete your account just now. Check your internet and try again, or WhatsApp us and we will do it for you.',
  },

  authErrors: {
    cancelled: 'Login was cancelled.',
    playServices: 'Google Play services is missing or out of date on this phone.',
    network: 'Your connection dropped. Check your internet and try again.',
    notEnabled: 'Login is not switched on yet. Please book without logging in for now.',
    unknown: 'Something went wrong. Please try again, or book without logging in.',
  },

  push: {
    channelName: 'Booking updates',
  },

  dates: {
    weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    /** (15, "3:30") → "3:30 pm" */
    time: (hour: number, clock: string) => `${clock} ${hour >= 12 ? 'pm' : 'am'}`,
    /** "Thu, 8 Oct" */
    day: (weekday: string, day: number, month: string) => `${weekday}, ${day} ${month}`,
    /** "Thu, 8 Oct, 3:30 pm" */
    dateTime: (date: string, time: string) => `${date}, ${time}`,
  },

  notFound: {
    title: 'Page not found',
    home: 'Go to home',
  },

  update: {
    title: 'Please update DriveBuddy',
    body: 'This version of the app is too old to book. The new one takes a minute to install.',
    button: 'Update now',
    orCall: 'Need a driver right now? Call or WhatsApp us.',
  },
};

export type Messages = typeof en;

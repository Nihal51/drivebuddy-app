/**
 * Every word the Driver app shows, in English. hi.ts has the same keys in
 * Hindi (most drivers read Hindi first); the type below makes a missing key a
 * build error.
 */

import type { PackageId } from '@drivebuddy/shared';

export const en = {
  appName: 'DriveBuddy Driver',
  languageName: 'English',

  login: {
    title: 'Driver login',
    subtitle: 'For DriveBuddy drivers. Use the mobile number you gave the office.',
    phoneLabel: 'Mobile number',
    phonePlaceholder: '98765 43210',
    sendCode: 'Send code',
    codeTitle: (phone: string) => `Enter the code sent to ${phone}`,
    codeLabel: 'Code from SMS',
    verify: 'Log in',
    changeNumber: 'Change number',
    codesLeft: (n: number) =>
      n === 1 ? '1 more code can be sent today.' : `${n} more codes can be sent today.`,
    errors: {
      'bad-phone': 'Please enter a 10-digit mobile number.',
      'not-a-driver': 'This number is not on a DriveBuddy driver record. Call the office to be added.',
      limit: (at: string) => `3 codes have been sent to this number in 24 hours. Try again after ${at}.`,
      busy: 'Login is busy right now. Please try again in a few minutes, or call the office.',
      'sms-failed': 'The SMS could not be sent. Please try again in a minute.',
      'not-configured': 'Driver login is not switched on yet. Please call the office.',
      'wrong-code': (left: number) => `That code is not right. ${left} ${left === 1 ? 'try' : 'tries'} left.`,
      expired: 'This code has expired. Ask for a new one.',
      'too-many-tries': 'Too many wrong codes. Ask for a new one.',
      network: 'No internet. Check your connection and try again.',
      unavailable: 'Something went wrong. Please try again, or call the office.',
    },
  },

  jobs: {
    title: 'My jobs',
    hello: (name: string) => `Namaste, ${name}`,
    empty: 'No jobs right now',
    emptyBody: 'When the office assigns you a booking, it appears here by itself.',
    sharing: 'Sharing location',
    asap: 'As soon as possible',
    callOffice: 'Call office',
    logout: 'Log out',
    logoutConfirm: 'Log out of DriveBuddy Driver?',
    cancel: 'Cancel',
    loadFailed: 'Could not load your jobs. Pull down to try again.',
    stillSharing:
      'You are still sharing your location on a job that is no longer yours. It has been stopped.',
  },

  online: {
    offTitle: 'You are offline',
    offBody: 'Go online to get job alerts. The nearest online drivers hear about new jobs first.',
    goOnline: 'Go online',
    onTitle: 'You are online',
    onBody: 'You get an alert for every new job near you. Your location is sent about every 2 minutes.',
    goOffline: 'Go offline',
    noAlerts: 'Job alerts could not be switched on on this phone. Keep the app open to see new offers.',
    permission:
      'Location permission is needed to go online. Allow it in Settings → Apps → DriveBuddy Driver.',
    gpsOff: 'Your GPS is off. Turn on Location and try again.',
    failed: 'Could not go online. Check your internet and try again.',
    serviceTitle: 'DriveBuddy Driver — online',
    serviceBody: 'You get alerts for new jobs near you',
    channel: 'Job offers',
  },

  offers: {
    title: 'New job offers',
    youEarn: (amount: string) => `You earn ${amount}`,
    accept: 'Accept job',
    acceptTitle: 'Take this job?',
    acceptBody: (amount: string) =>
      `You earn ${amount}. The customer's details appear in My jobs once you accept.`,
    gone: 'Another driver took this job first.',
    failed: 'Could not accept. Check your internet and try again.',
    accepted: 'The job is yours. It is now in My jobs. DriveBuddy will call you to confirm.',
    notActive: 'Job offers appear here once the office marks you Active.',
    popupNew: 'New job',
    popupRaised: 'Pay raised',
    notNow: 'Not now',
    closesIn: (seconds: number) => `Closes in ${seconds} s`,
  },

  earnings: {
    open: 'My earnings',
    title: 'My earnings',
    owed: 'DriveBuddy owes you',
    upcoming: 'After the job',
    paid: 'Paid to you',
    empty: 'Jobs you accept from offers appear here with what you earn.',
    statusOwed: 'To be paid',
    statusUpcoming: 'Job not done yet',
    statusPaid: (date: string) => `Paid ${date}`,
    note: 'DriveBuddy pays you your share after each completed job.',
    upiLabel: 'UPI ID for your pay',
    upiPlaceholder: 'name@okaxis',
    upiHint: 'DriveBuddy sends your pay to this UPI ID.',
    upiInvalid: 'This does not look like a UPI ID. It should look like name@okaxis.',
    upiSave: 'Save UPI ID',
    upiSavedAs: (upi: string) => `Your pay goes to ${upi}`,
    upiChange: 'Change',
    upiSaved: 'UPI ID saved.',
    upiFailed: 'Not saved. Check your internet and try again.',
    upiRefused: 'The UPI ID could not be saved. Please call the office.',
    ratingTitle: 'Your rating',
    rating: (avg: string, count: number) => `${avg} ★ from ${count} ${count === 1 ? 'rating' : 'ratings'}`,
    noRatings: 'No ratings yet. Customers rate you after each job.',
    strikes: (n: number) => (n === 1 ? '1 strike' : `${n} strikes`),
    strikesNote:
      'Giving back a job you accepted counts as a strike. With 3 or more, new jobs reach you after other drivers.',
    youOwe: 'You owe DriveBuddy',
    cashKept: (amount: string) => `Cash you kept ${amount}`,
    sumPays: (earned: string, cash: string, net: string) =>
      `Earned ${earned} · cash you kept ${cash} · DriveBuddy pays you ${net}`,
    sumOwe: (earned: string, cash: string, owe: string) =>
      `Earned ${earned} · cash you kept ${cash} · you owe DriveBuddy ${owe}`,
    overLimit: (amount: string) => `Settle ${amount} with DriveBuddy to get new jobs`,
    overLimitNote: (limit: string) =>
      `You are holding more than ${limit} of DriveBuddy's cash, so new job offers have stopped. Pay it to DriveBuddy by UPI, or call the office.`,
  },

  job: {
    title: 'Job',
    gone: 'This job is no longer assigned to you.',
    back: 'Back to my jobs',
    customer: 'Customer',
    call: 'Call',
    pickup: 'Pickup',
    navigate: 'Navigate',
    when: 'When',
    service: 'Service',
    tripTo: (to: string) => `Trip to ${to}`,
    notes: 'Notes',
    start: 'Start — on my way',
    startHint: 'Tap when you leave for the pickup. The customer sees you on the map.',
    arrived: 'Arrived — stop sharing',
    arrivedHint: 'Tap when you reach the customer. Your hours are counted from here.',
    done: 'Job done',
    doneHint: 'Tap when the customer no longer needs you.',
    doneTitle: 'Is the job done?',
    doneBody: "Tap only when the job is over. The customer's bill is made from this time.",
    doneConfirm: 'Yes, job done',
    home: 'Reached home',
    homeHint: 'After the drop, tap when you are back home.',
    homeTitle: 'Reached home?',
    homeBody: 'Your trip time ends here.',
    homeConfirm: 'Yes, reached home',
    allDone: 'All done. Thank you!',
    finished: 'Job done. Thank you! It has left your list.',
    tapsTitle: 'Trip times',
    taps: {
      leftAt: 'Left for pickup',
      arrivedAt: 'Arrived',
      doneAt: 'Job done',
      homeAt: 'Reached home',
    },
    tapFailed: 'Not saved. Check your internet and tap again.',
    tapRefused: 'This could not be saved. Please call the office.',
    shareAgain: 'Share my location',
    stopSharing: 'Stop sharing location',
    cantMake: "Can't make it",
    cantMakeTitle: 'Give this job back?',
    cantMakeBody:
      'The job goes back to other drivers. This counts as a strike on your record: drivers with many strikes get new jobs later.',
    cantMakeConfirm: 'Yes, give it back',
    cantMakeKeep: 'Keep the job',
    released: 'The job has been given back. Thank you for telling us in time.',
    releaseStarted: 'You have already started this job. Call the office if you cannot do it.',
    releaseFailed: 'Could not give the job back. Check your internet, or call the office.',
    sharingNow: 'Sharing your live location with the customer',
    sharingNote: 'Keep the app open or in the background. A notification stays on while sharing.',
    lastSent: (time: string) => `Last sent ${time}`,
    permissionDenied:
      'Location permission is needed to share your location. Allow it in Settings → Apps → DriveBuddy Driver.',
    openSettings: 'Open settings',
    gpsOff: 'Your GPS is off. Turn on Location and try again.',
    startFailed: 'Could not start sharing. Please try again.',
    otherJobSharing: 'You are already sharing on another job. Tap Arrived there first.',
    notificationTitle: 'DriveBuddy Driver',
    notificationBody: 'Sharing your location with the customer',
    payTitle: 'Payment',
    payInfo:
      "The customer pays DriveBuddy, not you: Pay in the DriveBuddy app, or scan DriveBuddy's QR. If they give you cash, take what their bill says — it comes off your next payout.",
    paidUpi: 'Paid by UPI',
    paidCash: 'Paid in cash',
    upiTitle: 'Paid by UPI?',
    upiBody: 'Tap only after the customer has paid DriveBuddy and shown you the payment done screen.',
    upiConfirm: 'Yes, paid by UPI',
    cashTitle: 'Paid in cash?',
    cashBody:
      "Tap only when you have the cash in hand. It is DriveBuddy's money: it comes off your next payout.",
    cashConfirm: 'Yes, paid in cash',
    recordedUpi: 'Payment recorded ✓ · UPI',
    recordedCash: 'Payment recorded ✓ · cash',
    confirmed: 'Confirmed by DriveBuddy ✓',
    toConfirm: 'DriveBuddy will call you to confirm this job',
  },

  packages: {
    '1-hour-300': '1 hour',
    '3-hours-600': '3 hours',
    'local-full-day': 'Full day in the city',
    outstation: 'Outstation trip',
    'night-driver': 'Night driver',
    'medical-emergency': 'Hospital / emergency',
    'monthly-basic': 'Monthly driver — Basic',
    'monthly-premium': 'Monthly driver — Premium',
    'wedding-event': 'Wedding / event',
    'one-way-drop': 'One-way car drop',
  } satisfies Record<PackageId, string>,
  unknownPackage: 'Driver booking',

  dates: {
    weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    time: (hour: number, clock: string) => `${clock} ${hour >= 12 ? 'pm' : 'am'}`,
    day: (weekday: string, day: number, month: string) => `${weekday}, ${day} ${month}`,
    dateTime: (date: string, time: string) => `${date}, ${time}`,
    today: 'Today',
  },
};

type Widen<T> = T extends string
  ? string
  : T extends readonly (infer U)[]
    ? readonly Widen<U>[]
    : T extends (...args: infer A) => infer R
      ? (...args: A) => Widen<R>
      : { [K in keyof T]: Widen<T[K]> };

export type Messages = Widen<typeof en>;

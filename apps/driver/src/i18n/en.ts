/**
 * Every word the Driver app shows, in English. hi.ts has the same keys in
 * Hindi (most drivers read Hindi first); the type below makes a missing key a
 * build error.
 */

import type { PackageId } from '@drivebuddy/shared';

export const en = {
  appName: 'DriveBuddy Driver',
  language: { toggle: 'हिंदी' },

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
    start: 'Start — share my location',
    startHint: 'Tap when you leave for the pickup. The customer sees you on the map.',
    arrived: 'Arrived — stop sharing',
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

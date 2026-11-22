/**
 * Build-time settings (public identifiers only): the same Firebase project as
 * thedrivebuddy.in and the customer app, so the driver sees the bookings the
 * office assigned in /admin. EXPO_PUBLIC_* values override them (a test project).
 */

const LIVE = {
  apiKey: 'AIzaSyCIGiv764yafx3HsmmbwpQuolKQcm64Ulo',
  authDomain: 'drive-buddy-acc4c.firebaseapp.com',
  projectId: 'drive-buddy-acc4c',
  storageBucket: 'drive-buddy-acc4c.firebasestorage.app',
  messagingSenderId: '56159522240',
  appId: '1:56159522240:web:d8454bea63494f064dcc25',
  /** The alerts robot (apps-script/Code.js on the website): sends and checks the SMS login codes. */
  robotUrl:
    'https://script.google.com/macros/s/AKfycbyJPR141acpum3KirDFgF8BFt79pE7Jf6wUPwbAzF0oyTjLCYuf3KTVdrKsYlIjHyvK/exec',
  /** The office, for "Call office" (DriveBuddy's public number). */
  officePhone: '9111473929',
  /** The website: its app-config.json has the cash limit (the customer app reads its prices there). */
  siteUrl: 'https://thedrivebuddy.in',
};

export const env = {
  firebase: {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || LIVE.apiKey,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || LIVE.authDomain,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || LIVE.projectId,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || LIVE.storageBucket,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || LIVE.messagingSenderId,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || LIVE.appId,
  },
  robotUrl: process.env.EXPO_PUBLIC_ROBOT_URL || LIVE.robotUrl,
  officePhone: process.env.EXPO_PUBLIC_OFFICE_PHONE || LIVE.officePhone,
  siteUrl: (process.env.EXPO_PUBLIC_SITE_URL || LIVE.siteUrl).replace(/\/+$/, ''),
};

/**
 * Build-time settings from .env (public identifiers only — see the comment
 * there). Expo inlines each `process.env.EXPO_PUBLIC_*` at build time, which
 * is why they are spelled out one by one instead of looped over.
 *
 * The Firebase project and the Google login ID also have the live values as
 * a fallback: `eas update --environment …` ignores .env files (EXPO_NO_DOTENV),
 * and an update published that way once shipped without them — no bookings,
 * no login. They are public (the website serves the same ones); .env.local or
 * EAS environment variables still override them, e.g. for a test project.
 */

const LIVE = {
  apiKey: 'AIzaSyCIGiv764yafx3HsmmbwpQuolKQcm64Ulo',
  authDomain: 'drive-buddy-acc4c.firebaseapp.com',
  projectId: 'drive-buddy-acc4c',
  storageBucket: 'drive-buddy-acc4c.firebasestorage.app',
  messagingSenderId: '56159522240',
  appId: '1:56159522240:web:d8454bea63494f064dcc25',
  googleWebClientId: '56159522240-opg8hdfldcp5e3fe0sct1bod3mmbgie9.apps.googleusercontent.com',
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
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || LIVE.googleWebClientId,
  siteUrl: (process.env.EXPO_PUBLIC_SITE_URL || 'https://thedrivebuddy.in').replace(/\/+$/, ''),
};

export const isFirebaseConfigured = () => Boolean(env.firebase.apiKey && env.firebase.projectId);

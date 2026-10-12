/**
 * Build-time settings from .env (public identifiers only — see the comment
 * there). Expo inlines each `process.env.EXPO_PUBLIC_*` at build time, which
 * is why they are spelled out one by one instead of looped over.
 */

export const env = {
  firebase: {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
  },
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
  siteUrl: (process.env.EXPO_PUBLIC_SITE_URL || 'https://thedrivebuddy.in').replace(/\/+$/, ''),
};

export const isFirebaseConfigured = () => Boolean(env.firebase.apiKey && env.firebase.projectId);

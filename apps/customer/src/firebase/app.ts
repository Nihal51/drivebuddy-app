/**
 * The one Firebase app — the same project as thedrivebuddy.in, so a booking
 * made here lands in the same admin panel, Google Sheet and Telegram alerts.
 */

import { type FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { type Firestore, getFirestore, initializeFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';

import { env } from '@/env';

let db: Firestore | undefined;

export function firebaseApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(env.firebase);
}

export function firestore(): Firestore {
  if (db) return db;
  const app = firebaseApp();
  try {
    // Mobile networks in India sometimes break Firestore's streaming connection;
    // long polling is slower to start but works on every network.
    db = initializeFirestore(app, Platform.OS === 'web' ? {} : { experimentalForceLongPolling: true });
  } catch {
    db = getFirestore(app); // already initialised (fast refresh during development)
  }
  return db;
}

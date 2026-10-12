/**
 * Firebase Auth on Android and iOS. The login is kept on the phone
 * (AsyncStorage), so customers stay logged in between app launches.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { type Auth, getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';

import { firebaseApp } from './app';

let auth: Auth | undefined;

export function firebaseAuth(): Auth {
  if (auth) return auth;
  const app = firebaseApp();
  try {
    auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch {
    auth = getAuth(app); // already initialised (fast refresh during development)
  }
  return auth;
}

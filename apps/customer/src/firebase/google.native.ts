/**
 * "Continue with Google" on Android and iOS: the native Google account picker
 * (no browser pop-up), then the same Firebase login the website uses — so a
 * customer who logged in on thedrivebuddy.in sees the same bookings here.
 *
 * Needs EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in .env and the app registered in
 * Firebase with its signing fingerprint (docs/SETUP.md, "Google login").
 */

import {
  GoogleSignin,
  isCancelledResponse,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';

import { env } from '@/env';

import { firebaseAuth } from './auth';

let configured = false;

export const isGoogleLoginAvailable = () => Boolean(env.googleWebClientId);

export async function signInWithGoogle(): Promise<'ok' | 'cancelled'> {
  if (!configured) {
    GoogleSignin.configure({ webClientId: env.googleWebClientId });
    configured = true;
  }
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const res = await GoogleSignin.signIn();
  if (isCancelledResponse(res)) return 'cancelled';
  const idToken = res.data.idToken;
  if (!idToken) throw Object.assign(new Error('Google returned no ID token'), { code: 'no-id-token' });
  await signInWithCredential(firebaseAuth(), GoogleAuthProvider.credential(idToken));
  return 'ok';
}

/** Forget the Google account choice too, so the next login shows the picker again. */
export async function signOutOfGoogle(): Promise<void> {
  try {
    if (configured) await GoogleSignin.signOut();
  } catch {
    /* already signed out of Google */
  }
}

export type AuthErrorKind = 'cancelled' | 'playServices' | 'network' | 'notEnabled' | 'unknown';

export function authErrorKind(err: unknown): AuthErrorKind {
  if (isErrorWithCode(err)) {
    if (err.code === statusCodes.SIGN_IN_CANCELLED || err.code === statusCodes.IN_PROGRESS)
      return 'cancelled';
    if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) return 'playServices';
  }
  const code = typeof err === 'object' && err && 'code' in err ? String((err as { code: unknown }).code) : '';
  if (code.includes('network')) return 'network';
  if (code.includes('operation-not-allowed') || code.includes('DEVELOPER_ERROR') || code === '10')
    return 'notEnabled';
  return 'unknown';
}

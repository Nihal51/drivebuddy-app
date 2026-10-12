/**
 * "Continue with Google" in the web preview: Firebase's own pop-up, exactly
 * like the website. The phone apps use google.native.ts.
 */

import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

import { firebaseAuth } from './auth';

export const isGoogleLoginAvailable = () => true;

export async function signInWithGoogle(): Promise<'ok' | 'cancelled'> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(firebaseAuth(), provider);
    return 'ok';
  } catch (err) {
    if (authErrorKind(err) === 'cancelled') return 'cancelled';
    throw err;
  }
}

export async function signOutOfGoogle(): Promise<void> {
  /* the web pop-up keeps no separate Google session in the app */
}

export type AuthErrorKind = 'cancelled' | 'playServices' | 'network' | 'notEnabled' | 'unknown';

export function authErrorKind(err: unknown): AuthErrorKind {
  const code = typeof err === 'object' && err && 'code' in err ? String((err as { code: unknown }).code) : '';
  if (code.includes('popup-closed-by-user') || code.includes('cancelled-popup-request')) return 'cancelled';
  if (code.includes('network')) return 'network';
  if (code.includes('operation-not-allowed') || code.includes('unauthorized-domain')) return 'notEnabled';
  return 'unknown';
}

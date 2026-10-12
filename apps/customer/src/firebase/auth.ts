/**
 * Firebase Auth in the web preview (`npm run customer:web`). The phone apps
 * use auth.native.ts instead; Metro picks the right file per platform.
 */

import { type Auth, getAuth } from 'firebase/auth';

import { firebaseApp } from './app';

export function firebaseAuth(): Auth {
  return getAuth(firebaseApp());
}

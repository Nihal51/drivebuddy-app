/**
 * Who is logged in, their profile, and whether booking updates reach this
 * phone. Logging in is optional everywhere: a guest can book; logging in adds
 * "My bookings", notifications and pre-filled details.
 */

import { type Profile, validateName } from '@drivebuddy/shared';
import { type User, deleteUser, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { deleteProfile, loadProfile, saveProfile as writeProfile } from '@/data/profile';
import { isFirebaseConfigured } from '@/env';
import { firebaseAuth } from '@/firebase/auth';
import { type AuthErrorKind, authErrorKind, signInWithGoogle, signOutOfGoogle } from '@/firebase/google';
import { useI18n } from '@/i18n';
import { track } from '@/lib/analytics';
import { reportError } from '@/lib/monitoring';
import { type PushState, disablePush, enablePush, pushState } from '@/notifications/push';

export type SignInResult =
  { ok: true } | { ok: false; error: AuthErrorKind } | { ok: false; cancelled: true };
export type DeleteResult = 'deleted' | 'cancelled' | 'failed';

export type AuthContextValue = {
  /** False until Firebase has restored any saved login. */
  ready: boolean;
  user: User | null;
  profile: Profile | null;
  push: PushState;
  signIn: () => Promise<SignInResult>;
  signOut: () => Promise<void>;
  saveProfile: (p: Profile) => Promise<void>;
  enableNotifications: () => Promise<PushState>;
  /** Store rules (Google Play and Apple) require deleting an account from inside the app. */
  deleteAccount: () => Promise<DeleteResult>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/** A first-time Google login gets a profile from the Google name, if it is a usable one. */
function profileFromGoogle(user: User): Profile | null {
  const name = (user.displayName ?? '').trim();
  return validateName(name) ? null : { name, phone: '', email: user.email ?? '' };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { lang, t } = useI18n();
  const [ready, setReady] = useState(!isFirebaseConfigured());
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileExists, setProfileExists] = useState(false);
  const [push, setPush] = useState<PushState>('off');

  // The latest language for callbacks, without re-subscribing to auth on every change.
  const langRef = useRef(lang);
  useEffect(() => {
    langRef.current = lang;
  }, [lang]);
  const channelName = t.push.channelName;

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    return onAuthStateChanged(firebaseAuth(), async (next) => {
      setUser(next);
      if (!next) {
        setProfile(null);
        setProfileExists(false);
        setPush(await pushState().catch(() => 'off' as const));
        setReady(true);
        return;
      }
      try {
        const stored = await loadProfile(next.uid);
        if (stored) {
          setProfile(stored);
          setProfileExists(true);
        } else {
          const fromGoogle = profileFromGoogle(next);
          if (fromGoogle) {
            setProfile(await writeProfile(next.uid, fromGoogle, true));
            setProfileExists(true);
          } else {
            setProfile({ name: '', phone: '', email: next.email ?? '' });
          }
        }
      } catch {
        setProfile({ name: next.displayName ?? '', phone: '', email: next.email ?? '' });
      }
      setReady(true);
      // Refresh this phone's registration silently (never prompts here).
      setPush(await enablePush(next.uid, langRef.current, { ask: false, channelName }));
    });
  }, [channelName]);

  // Status updates follow the language chosen in the app.
  useEffect(() => {
    if (user && push === 'on') void enablePush(user.uid, lang, { ask: false, channelName });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a language change should re-register
  }, [lang]);

  const signIn = useCallback(async (): Promise<SignInResult> => {
    try {
      const result = await signInWithGoogle();
      if (result === 'cancelled') return { ok: false, cancelled: true };
      track('login_completed');
      const uid = firebaseAuth().currentUser?.uid;
      // The moment they log in is the moment they expect updates: ask now.
      if (uid) setPush(await enablePush(uid, langRef.current, { ask: true, channelName }));
      return { ok: true };
    } catch (err) {
      const kind = authErrorKind(err);
      return kind === 'cancelled' ? { ok: false, cancelled: true } : { ok: false, error: kind };
    }
  }, [channelName]);

  const signOut = useCallback(async () => {
    const uid = firebaseAuth().currentUser?.uid;
    if (uid) await disablePush(uid);
    await signOutOfGoogle();
    await firebaseSignOut(firebaseAuth());
    track('logged_out');
  }, []);

  const saveProfile = useCallback(
    async (p: Profile) => {
      if (!user) return;
      const saved = await writeProfile(user.uid, { ...p, email: user.email ?? '' }, !profileExists);
      setProfile(saved);
      setProfileExists(true);
    },
    [user, profileExists],
  );

  const enableNotifications = useCallback(async () => {
    if (!user) return push;
    const next = await enablePush(user.uid, langRef.current, { ask: true, channelName });
    setPush(next);
    if (next === 'on') track('notifications_enabled');
    return next;
  }, [user, push, channelName]);

  const deleteAccount = useCallback(async (): Promise<DeleteResult> => {
    const auth = firebaseAuth();
    const current = auth.currentUser;
    if (!current) return 'failed';
    try {
      await disablePush(current.uid);
      await deleteProfile(current.uid);
      try {
        await deleteUser(current);
      } catch (err) {
        // Firebase asks for a fresh login before deleting an account: one more Google tap.
        const code =
          typeof err === 'object' && err && 'code' in err ? String((err as { code: unknown }).code) : '';
        if (!code.includes('requires-recent-login')) throw err;
        if ((await signInWithGoogle()) === 'cancelled') return 'cancelled';
        if (!auth.currentUser) return 'failed';
        await deleteUser(auth.currentUser);
      }
      await signOutOfGoogle();
      return 'deleted';
    } catch (err) {
      if (__DEV__) console.warn('[drivebuddy] account deletion failed', err);
      reportError(err, 'delete-account');
      return 'failed';
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ready, user, profile, push, signIn, signOut, saveProfile, enableNotifications, deleteAccount }),
    [ready, user, profile, push, signIn, signOut, saveProfile, enableNotifications, deleteAccount],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export { AuthContext };

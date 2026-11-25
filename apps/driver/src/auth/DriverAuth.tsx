/**
 * Who is logged in. A driver login is a Firebase custom token from the alerts
 * robot with the claims { role: 'driver', driverPhone, driverId }; the login
 * is kept on the phone, so a driver needs a new SMS code only on a new phone
 * or after logging out.
 */

import { type User, onAuthStateChanged, signInWithCustomToken, signOut } from 'firebase/auth';
import { type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { forgetThisPhone, phoneToken } from '@/data/alerts';
import { within } from '@/data/write';
import { firebaseAuth } from '@/firebase/auth';
import { readStored, writeStored } from '@/lib/storage';
import { forgetPushToken, goOffline, stopSharing } from '@/tracking/sharing';

export type Driver = { uid: string; phone: string; name: string; driverId: string };

type State = { status: 'loading' } | { status: 'out' } | { status: 'in'; driver: Driver };

type DriverAuth = {
  state: State;
  /** After the robot accepted the SMS code. */
  logIn: (token: string, name: string, phone: string) => Promise<void>;
  logOut: () => Promise<void>;
};

const NAME_KEY = 'dbd.driverName';
const PHONE_KEY = 'dbd.driverPhone';
const ID_KEY = 'dbd.driverId';
const Ctx = createContext<DriverAuth | null>(null);

/** A Firebase user → a driver, or null when the login is not a driver login. */
export async function driverOf(user: User, savedName: string | null): Promise<Driver | null> {
  const { claims } = await user.getIdTokenResult();
  const phone = typeof claims.driverPhone === 'string' ? claims.driverPhone : '';
  if (claims.role !== 'driver' || !/^[6-9]\d{9}$/.test(phone)) return null;
  const driverId = typeof claims.driverId === 'string' ? claims.driverId : '';
  return { uid: user.uid, phone, name: savedName ?? '', driverId };
}

export function DriverAuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    const auth = firebaseAuth();
    return onAuthStateChanged(auth, (user) => {
      if (!user) {
        setState({ status: 'out' });
        return;
      }
      void (async () => {
        try {
          const driver = await driverOf(user, await readStored(NAME_KEY));
          if (driver) {
            await writeStored(ID_KEY, driver.driverId);
            setState({ status: 'in', driver });
          } else {
            await signOut(auth);
            setState({ status: 'out' });
          }
        } catch {
          // Offline at launch with an expired token: the login is still good and
          // Firebase refreshes it when the network is back, so carry on with the
          // number saved at login (the rules still check the real token).
          const phone = await readStored(PHONE_KEY);
          if (phone && /^[6-9]\d{9}$/.test(phone)) {
            setState({
              status: 'in',
              driver: {
                uid: user.uid,
                phone,
                name: (await readStored(NAME_KEY)) ?? '',
                driverId: (await readStored(ID_KEY)) ?? '',
              },
            });
          } else setState({ status: 'out' });
        }
      })();
    });
  }, []);

  const logIn = useCallback(async (token: string, name: string, phone: string) => {
    await writeStored(NAME_KEY, name);
    await writeStored(PHONE_KEY, phone);
    await signInWithCustomToken(firebaseAuth(), token);
  }, []);

  const logOut = useCallback(async () => {
    await stopSharing().catch(() => {});
    // Offline, the write would wait for the network: the logout does not.
    await within(goOffline(), 8_000).catch(() => {});
    // After going offline (which keeps the token): this phone stops getting his alerts.
    if (state.status === 'in') await forgetPushToken(state.driver.driverId, phoneToken());
    forgetThisPhone();
    await signOut(firebaseAuth());
  }, [state]);

  const value = useMemo(() => ({ state, logIn, logOut }), [state, logIn, logOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDriverAuth(): DriverAuth {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useDriverAuth must be used inside <DriverAuthProvider>');
  return ctx;
}

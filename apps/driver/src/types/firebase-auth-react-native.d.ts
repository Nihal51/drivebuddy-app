/**
 * firebase/auth ships `getReactNativePersistence` in its React Native build
 * (Metro picks it via the "react-native" export condition) but leaves it out of
 * the default type definitions. This declares the one missing function.
 */

import type { Persistence } from 'firebase/auth';

declare module 'firebase/auth' {
  interface ReactNativeAsyncStorage {
    setItem(key: string, value: string): Promise<void>;
    getItem(key: string): Promise<string | null>;
    removeItem(key: string): Promise<void>;
  }
  export function getReactNativePersistence(storage: ReactNativeAsyncStorage): Persistence;
}

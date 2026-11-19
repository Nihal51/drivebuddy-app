/**
 * Small on-phone memory (language, the last good price list). Never essential:
 * every read can come back empty and every write can fail without breaking a
 * screen, so both are wrapped.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export async function readStored(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function writeStored(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    /* storage full or unavailable — the value is optional */
  }
}

export async function readJson<T>(key: string): Promise<T | null> {
  const raw = await readStored(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export const writeJson = (key: string, value: unknown) => writeStored(key, JSON.stringify(value));

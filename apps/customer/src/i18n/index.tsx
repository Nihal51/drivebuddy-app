/**
 * English / Hindi. The first launch follows the phone's language; the choice
 * in Account (or the toggle on Home) is remembered on the phone and sent with
 * the push-notification registration, so status updates arrive in the same
 * language.
 */

import { type Language, isLanguage } from '@drivebuddy/shared';
import { getLocales } from 'expo-localization';
import { type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { readStored, writeStored } from '@/lib/storage';

import { type Messages, en } from './en';
import { hi } from './hi';

const MESSAGES: Record<Language, Messages> = { en, hi };
const STORAGE_KEY = 'db.language';

export function deviceLanguage(): Language {
  try {
    return getLocales().some((l) => l.languageCode === 'hi') ? 'hi' : 'en';
  } catch {
    return 'en';
  }
}

type I18n = { lang: Language; t: Messages; setLang: (lang: Language) => void };

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ children, initial }: { children: ReactNode; initial?: Language }) {
  const [lang, setLangState] = useState<Language>(initial ?? deviceLanguage());

  useEffect(() => {
    if (initial) return;
    let alive = true;
    readStored(STORAGE_KEY).then((saved) => {
      if (alive && isLanguage(saved)) setLangState(saved);
    });
    return () => {
      alive = false;
    };
  }, [initial]);

  const setLang = useCallback((next: Language) => {
    setLangState(next);
    void writeStored(STORAGE_KEY, next);
  }, []);

  const value = useMemo(() => ({ lang, t: MESSAGES[lang], setLang }), [lang, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * The language, or null outside the provider (the crash screen renders there).
 * Text components use this so they can never crash the crash screen.
 */
export const useOptionalLang = (): Language | null => useContext(I18nContext)?.lang ?? null;

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}

export { MESSAGES };
export type { Messages };

/**
 * Renders a screen inside the real theme, language and price providers, with a
 * fake login. Screens under test never touch Firebase. Await it: rendering is
 * asynchronous in React Native Testing Library 14.
 */

import { type AppConfig, DEFAULT_CONFIG, type Language } from '@drivebuddy/shared';
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { AuthContext, type AuthContextValue } from '@/auth/AuthProvider';
import { ConfigProvider } from '@/config/ConfigProvider';
import { I18nProvider } from '@/i18n';
import { type Scheme, ThemeProvider } from '@/theme';

export const signedOut: AuthContextValue = {
  ready: true,
  user: null,
  profile: null,
  push: 'off',
  signIn: jest.fn(async () => ({ ok: true as const })),
  signOut: jest.fn(async () => {}),
  saveProfile: jest.fn(async () => {}),
  enableNotifications: jest.fn(async () => 'on' as const),
  deleteAccount: jest.fn(async () => 'deleted' as const),
};

export function renderScreen(
  ui: ReactElement,
  {
    lang = 'en',
    auth = signedOut,
    config = DEFAULT_CONFIG,
    configSource = 'built-in',
    scheme = 'light',
  }: {
    lang?: Language;
    auth?: AuthContextValue;
    config?: AppConfig;
    configSource?: 'built-in' | 'saved' | 'live';
    scheme?: Scheme;
  } = {},
) {
  return render(
    <ThemeProvider scheme={scheme}>
      <I18nProvider initial={lang}>
        <ConfigProvider initial={config} initialSource={configSource}>
          <AuthContext.Provider value={auth}>{ui}</AuthContext.Provider>
        </ConfigProvider>
      </I18nProvider>
    </ThemeProvider>,
  );
}

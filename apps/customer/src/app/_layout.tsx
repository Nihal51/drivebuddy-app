import {
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { type ErrorBoundaryProps, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/auth/AuthProvider';
import { CrashScreen } from '@/components/CrashScreen';
import { NotificationRouter } from '@/components/NotificationRouter';
import { UpdateGate } from '@/components/UpdateGate';
import { ConfigProvider } from '@/config/ConfigProvider';
import { I18nProvider, useI18n } from '@/i18n';
import { track } from '@/lib/analytics';
import { initMonitoring, withMonitoring } from '@/lib/monitoring';
import { configureNotificationHandler } from '@/notifications/push';
import { ThemeProvider, fonts, useTheme } from '@/theme';

initMonitoring();
void SplashScreen.preventAutoHideAsync().catch(() => {});
configureNotificationHandler();

/** Any crash below shows a friendly page with Call / WhatsApp instead of a white screen. */
export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <CrashScreen {...props} />;
}

export default withMonitoring(RootLayout);

function RootLayout() {
  const [loaded, error] = useFonts({
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    if (loaded || error) void SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);

  useEffect(() => {
    track('app_opened');
  }, []);

  // A font that fails to load is not worth a blank app: carry on with the system font.
  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <I18nProvider>
          <ConfigProvider>
            <AuthProvider>
              {Platform.OS !== 'web' ? <NotificationRouter /> : null}
              <UpdateGate>
                <AppStack />
              </UpdateGate>
            </AuthProvider>
          </ConfigProvider>
        </I18nProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function AppStack() {
  const { t, lang } = useI18n();
  const { colors, scheme } = useTheme();

  // The colour behind the app (seen while the keyboard opens or a screen slides).
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
  }, [colors.background]);

  const titleFont = lang === 'hi' ? { fontWeight: '800' as const } : { fontFamily: fonts.heavy };
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerTintColor: colors.text,
          headerTitleStyle: { ...titleFont, fontSize: 17, color: colors.text },
          headerStyle: { backgroundColor: colors.surface },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="book" options={{ title: t.book.title }} />
        <Stack.Screen name="booking/[id]" options={{ title: t.detail.title }} />
        <Stack.Screen name="+not-found" options={{ title: t.notFound.title }} />
      </Stack>
    </>
  );
}

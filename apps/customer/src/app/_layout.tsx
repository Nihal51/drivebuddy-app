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
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/auth/AuthProvider';
import { CrashScreen } from '@/components/CrashScreen';
import { NotificationRouter } from '@/components/NotificationRouter';
import { ConfigProvider } from '@/config/ConfigProvider';
import { I18nProvider, useI18n } from '@/i18n';
import { configureNotificationHandler } from '@/notifications/push';
import { colors, fonts } from '@/theme';

void SplashScreen.preventAutoHideAsync().catch(() => {});
configureNotificationHandler();

/** Any crash below shows a friendly page with Call / WhatsApp instead of a white screen. */
export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <CrashScreen {...props} />;
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    if (loaded || error) void SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);

  // A font that fails to load is not worth a blank app: carry on with the system font.
  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <I18nProvider>
        <ConfigProvider>
          <AuthProvider>
            <StatusBar style="dark" />
            {Platform.OS !== 'web' ? <NotificationRouter /> : null}
            <AppStack />
          </AuthProvider>
        </ConfigProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}

function AppStack() {
  const { t, lang } = useI18n();
  const titleFont = lang === 'hi' ? { fontWeight: '800' as const } : { fontFamily: fonts.heavy };
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.ink,
        headerTitleStyle: { ...titleFont, fontSize: 17 },
        headerStyle: { backgroundColor: colors.white },
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
  );
}

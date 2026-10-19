import type { ErrorBoundaryProps } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DEFAULT_CONFIG, telUrl, whatsappUrl } from '@drivebuddy/shared';

import { openUrl } from '@/lib/links';
import { reportError } from '@/lib/monitoring';
import { ThemeProvider, space, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';

/**
 * Shown if a screen crashes. It cannot rely on the app's other providers (they
 * may be what failed), so it uses the built-in phone numbers and both
 * languages at once, and brings its own light/dark theme.
 */
export function CrashScreen(props: ErrorBoundaryProps) {
  return (
    <ThemeProvider>
      <CrashContent {...props} />
    </ThemeProvider>
  );
}

function CrashContent({ error, retry }: ErrorBoundaryProps) {
  const { colors } = useTheme();
  useEffect(() => {
    if (__DEV__) console.error(error);
    reportError(error, 'crash');
  }, [error]);
  const { phone, whatsapp } = DEFAULT_CONFIG.contact;
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={styles.box}>
        <AppText variant="title" weight="heavy" align="center">
          Something went wrong
        </AppText>
        <AppText variant="title" weight="heavy" align="center">
          कुछ गड़बड़ हो गई
        </AppText>
        <AppText color={colors.textMuted} align="center">
          Need a driver now? Call or WhatsApp us. / ड्राइवर अभी चाहिए? कॉल या WhatsApp करें।
        </AppText>
        <Button title="Try again / फिर से कोशिश करें" icon="refresh" onPress={() => void retry()} />
        <Button title="Call" icon="call" variant="outline" onPress={() => void openUrl(telUrl(phone))} />
        <Button
          title="WhatsApp"
          icon="logo-whatsapp"
          variant="whatsapp"
          onPress={() => void openUrl(whatsappUrl(whatsapp))}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, justifyContent: 'center' },
  box: { padding: space.xl, gap: space.md, maxWidth: 480, width: '100%', alignSelf: 'center' },
});

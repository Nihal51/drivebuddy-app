import type { ErrorBoundaryProps } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DEFAULT_CONFIG, telUrl, whatsappUrl } from '@drivebuddy/shared';

import { openUrl } from '@/lib/links';
import { colors, space } from '@/theme';

import { Button } from './Button';
import { AppText } from './AppText';

/**
 * Shown if a screen crashes. It cannot rely on the app's providers (they may be
 * what failed), so it uses the built-in phone numbers and both languages at once.
 */
export function CrashScreen({ error, retry }: ErrorBoundaryProps) {
  if (__DEV__) console.error(error);
  const { phone, whatsapp } = DEFAULT_CONFIG.contact;
  return (
    <SafeAreaView style={styles.safe}>
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
  safe: { flex: 1, backgroundColor: colors.background, justifyContent: 'center' },
  box: { padding: space.xl, gap: space.md, maxWidth: 480, width: '100%', alignSelf: 'center' },
});

import { mustUpdate } from '@drivebuddy/shared';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Application from 'expo-application';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useConfig } from '@/config/ConfigProvider';
import { useI18n } from '@/i18n';
import { openUrl } from '@/lib/links';
import { space, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';
import { ContactActions } from './ContactActions';

/**
 * The "please update" switch: when the website's app.minVersion is above this
 * app's version, the app stops here instead of booking with outdated rules.
 * Only a downloaded config can trigger it — never the built-in copy.
 */
export function UpdateGate({ children }: { children: ReactNode }) {
  const { config, source } = useConfig();
  const { t } = useI18n();
  const { colors } = useTheme();
  const installed = Platform.OS === 'web' ? null : Application.nativeApplicationVersion;
  if (source === 'built-in' || !mustUpdate(installed, config)) return children;

  const storeUrl = Platform.OS === 'ios' ? config.app.appStoreUrl : config.app.playStoreUrl;
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={styles.box}>
        <View style={[styles.icon, { backgroundColor: colors.amberSoft }]}>
          <Ionicons name="cloud-download-outline" size={34} color={colors.amberText} />
        </View>
        <AppText variant="title" weight="heavy" align="center" accessibilityRole="header">
          {t.update.title}
        </AppText>
        <AppText align="center" color={colors.textMuted}>
          {t.update.body}
        </AppText>
        {storeUrl ? (
          <Button title={t.update.button} icon="arrow-up-circle" onPress={() => void openUrl(storeUrl)} />
        ) : null}
        <AppText variant="small" align="center" color={colors.textMuted}>
          {t.update.orCall}
        </AppText>
        <ContactActions />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, justifyContent: 'center' },
  box: { padding: space.xl, gap: space.md, maxWidth: 480, width: '100%', alignSelf: 'center' },
  icon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
});

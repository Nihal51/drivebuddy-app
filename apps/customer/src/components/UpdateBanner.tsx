import Ionicons from '@expo/vector-icons/Ionicons';
import * as Updates from 'expo-updates';
import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '@/i18n';
import { track } from '@/lib/analytics';
import { cardShadow, makeStyles, radius, space, useTheme } from '@/theme';

import { AppText } from './AppText';

/** How often the app looks again for a new version while it is open. */
const RECHECK_MS = 10 * 60 * 1000;

/**
 * "New version ready — Update": when a new version has been published
 * (`eas update`), the app downloads it in the background and says so on
 * screen, instead of waiting for the customer to close and reopen it. Tapping
 * Update restarts the app on the new version; Later hides the note until the
 * next time the app opens (the new version is then used anyway).
 */
export function UpdateBanner() {
  // Off in development, tests and the web preview: there is nothing to update there.
  if (!Updates.isEnabled) return null;
  return <LiveUpdateBanner />;
}

export function LiveUpdateBanner() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { isUpdateAvailable, isUpdatePending, isDownloading } = Updates.useUpdates();
  const [hidden, setHidden] = useState(false);
  // The app checked at start-up; the next look is RECHECK_MS after the first return to the screen.
  const lastCheck = useRef(0);

  // The app also looks when it comes back to the screen, not only when it starts.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      const now = Date.now();
      if (state !== 'active' || now - lastCheck.current < RECHECK_MS) return;
      lastCheck.current = now;
      Updates.checkForUpdateAsync().catch(() => {});
    });
    return () => sub.remove();
  }, []);

  // Found one: download it straight away, quietly.
  useEffect(() => {
    if (isUpdateAvailable && !isUpdatePending && !isDownloading) Updates.fetchUpdateAsync().catch(() => {});
  }, [isUpdateAvailable, isUpdatePending, isDownloading]);

  if (!isUpdatePending || hidden) return null;

  return (
    <View
      style={[styles.wrap, { top: insets.top + space.sm }]}
      accessibilityLiveRegion="polite"
      testID="update-banner"
    >
      <View style={styles.card}>
        <View style={styles.icon}>
          <Ionicons name="sparkles" size={18} color={colors.onAmber} />
        </View>
        <View style={styles.text}>
          <AppText weight="heavy">{t.update.readyTitle}</AppText>
          <AppText variant="small" color={colors.textMuted}>
            {t.update.readyBody}
          </AppText>
        </View>
        <Pressable
          onPress={() => setHidden(true)}
          accessibilityRole="button"
          hitSlop={8}
          testID="update-later"
        >
          <AppText variant="small" weight="bold" color={colors.textMuted}>
            {t.update.later}
          </AppText>
        </Pressable>
        <Pressable
          onPress={() => {
            track('app_updated_from_banner');
            Updates.reloadAsync().catch(() => {});
          }}
          accessibilityRole="button"
          style={({ pressed }) => [styles.button, pressed ? styles.buttonPressed : null]}
          testID="update-now"
        >
          <AppText variant="small" weight="heavy" color={colors.onAmber}>
            {t.update.readyButton}
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { position: 'absolute', left: space.md, right: space.md, alignItems: 'center', zIndex: 100 },
  card: {
    width: '100%',
    maxWidth: 560,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm + 2,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: c.bar,
    borderWidth: 1,
    borderColor: c.line,
    ...cardShadow(c),
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: c.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1 },
  button: {
    backgroundColor: c.amber,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    minHeight: 40,
    justifyContent: 'center',
  },
  buttonPressed: { backgroundColor: c.amberPressed },
}));

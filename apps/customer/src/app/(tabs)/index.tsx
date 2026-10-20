import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Image, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { type Category, CATEGORIES, categoryRoute } from '@/booking/categories';
import { AppText } from '@/components/AppText';
import { BrandMark, Notice } from '@/components/bits';
import type { IconName } from '@/components/Button';
import { ContactActions } from '@/components/ContactActions';
import { LanguageToggle } from '@/components/LanguageToggle';
import { Screen } from '@/components/Screen';
import { ServiceCard, ServiceRow } from '@/components/ServiceTile';
import { useConfig } from '@/config/ConfigProvider';
import { useI18n } from '@/i18n';
import { makeStyles, radius, space, useTheme } from '@/theme';

/** The two services most customers come for, as big cards; everything else in the list below. */
const FEATURED: Category['id'][] = ['hourly', 'drop'];

const open = (c: Category) => router.push(categoryRoute(c));

/**
 * Home: a friendly hello from our driver, the two services most people book
 * as big cards, and every other service — monthly driver, hospital, weddings —
 * in a short list. A tap opens the booking at the right step.
 */
export default function HomeScreen() {
  const { t } = useI18n();
  const { config } = useConfig();
  const { profile } = useAuth();
  const { colors } = useTheme();
  const styles = useStyles();
  const firstName = profile?.name.split(' ')[0];
  const featured = FEATURED.map((id) => CATEGORIES.find((c) => c.id === id)).filter((c): c is Category =>
    Boolean(c),
  );
  const rest = CATEGORIES.filter((c) => !FEATURED.includes(c.id));

  return (
    <Screen>
      <View style={styles.header}>
        <BrandMark />
        <LanguageToggle size="small" />
      </View>

      {config.notice.show && config.notice.text ? <Notice text={config.notice.text} /> : null}

      <Welcome name={firstName} />

      <View style={styles.cards}>
        {featured.map((c, i) => (
          <ServiceCard key={c.id} category={c} tone={i === 0 ? 'amber' : 'dark'} onPress={() => open(c)} />
        ))}
      </View>

      <View>
        <AppText variant="tiny" weight="heavy" color={colors.textMuted} style={styles.label}>
          {t.home.moreServices.toUpperCase()}
        </AppText>
        {rest.map((c) => (
          <ServiceRow key={c.id} category={c} onPress={() => open(c)} />
        ))}
      </View>

      <View style={styles.help}>
        <View>
          <AppText weight="heavy">{t.home.helpTitle}</AppText>
          <AppText variant="small" color={colors.textMuted}>
            {t.home.helpBody}
          </AppText>
        </View>
        <ContactActions compact />
      </View>
    </Screen>
  );
}

/** "Hello, Ravi — your driver, at your door in 30 minutes", with our driver waving. */
function Welcome({ name }: { name?: string }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useStyles();
  const badges: { icon: IconName; label: string; tone: 'green' | 'plain' }[] = [
    { icon: 'shield-checkmark', label: t.home.badges.verified, tone: 'green' },
    { icon: 'ban', label: t.home.badges.sober, tone: 'plain' },
  ];
  return (
    <View style={styles.welcome} testID="home-welcome">
      <View style={styles.welcomeText}>
        <AppText variant="small" weight="bold" color={colors.textMuted}>
          {name ? t.home.greeting(name) : t.home.welcome}
        </AppText>
        <AppText variant="title" weight="heavy" accessibilityRole="header">
          {t.home.title}
        </AppText>
        <View style={styles.badges}>
          {badges.map((b) => (
            <View key={b.label} style={[styles.badge, b.tone === 'green' ? styles.badgeGreen : null]}>
              <Ionicons name={b.icon} size={12} color={b.tone === 'green' ? colors.success : colors.text} />
              <AppText variant="tiny" weight="bold" color={b.tone === 'green' ? colors.success : colors.text}>
                {b.label}
              </AppText>
            </View>
          ))}
        </View>
      </View>
      <Image
        source={require('../../../assets/images/driver-wave.png')}
        style={styles.driver}
        resizeMode="contain"
        accessible={false}
        importantForAccessibility="no"
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  welcome: {
    backgroundColor: c.cream,
    borderRadius: radius.xl,
    padding: space.lg + 2,
    minHeight: 176,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  // Leaves the right side to the driver.
  welcomeText: { width: '62%', gap: space.xs },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: space.sm },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: c.background,
  },
  badgeGreen: { backgroundColor: c.successSoft },
  driver: { position: 'absolute', right: -6, bottom: -28, width: 150, height: 160 },
  cards: { flexDirection: 'row', gap: space.sm + 2 },
  label: { marginBottom: space.xs, letterSpacing: 0.4 },
  help: { gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: c.surface },
}));

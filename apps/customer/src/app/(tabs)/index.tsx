import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { CATEGORIES, categoryRoute } from '@/booking/categories';
import { AppText } from '@/components/AppText';
import { BrandMark, Notice } from '@/components/bits';
import { ContactActions } from '@/components/ContactActions';
import { LanguageToggle } from '@/components/LanguageToggle';
import { Screen } from '@/components/Screen';
import { ServiceGrid, ServiceTile } from '@/components/ServiceTile';
import { useConfig } from '@/config/ConfigProvider';
import { useI18n } from '@/i18n';
import { makeStyles, radius, space, useTheme } from '@/theme';

/**
 * Home: one question — what do you need? — and the eight answers as tiles.
 * A tile opens the booking at the right step; everything else (prices in
 * detail, the small print) waits until the customer has chosen.
 */
export default function HomeScreen() {
  const { t } = useI18n();
  const { config } = useConfig();
  const { profile } = useAuth();
  const { colors } = useTheme();
  const styles = useStyles();
  const firstName = profile?.name.split(' ')[0];

  return (
    <Screen>
      <View style={styles.header}>
        <BrandMark />
        <LanguageToggle size="small" />
      </View>

      {config.notice.show && config.notice.text ? <Notice text={config.notice.text} /> : null}

      <View style={styles.intro}>
        {firstName ? (
          <AppText weight="bold" color={colors.textMuted}>
            {t.home.greeting(firstName)}
          </AppText>
        ) : null}
        <AppText variant="display" weight="heavy" accessibilityRole="header">
          {t.home.title}
        </AppText>
        <AppText color={colors.textMuted}>{t.home.subtitle}</AppText>
      </View>

      <ServiceGrid>
        {CATEGORIES.map((c) => (
          <ServiceTile key={c.id} category={c} onPress={() => router.push(categoryRoute(c))} />
        ))}
      </ServiceGrid>

      <View style={styles.trust}>
        {t.pillars.slice(0, 3).map((p) => (
          <View key={p.title} style={styles.trustItem}>
            <Ionicons name={p.icon} size={16} color={colors.success} />
            <AppText variant="tiny" weight="bold" color={colors.textMuted}>
              {p.title}
            </AppText>
          </View>
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

const useStyles = makeStyles((c) => ({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  intro: { gap: space.xs, marginTop: space.sm },
  trust: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.md },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  help: { gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: c.surface },
}));

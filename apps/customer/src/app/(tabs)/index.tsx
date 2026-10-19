import { PACKAGE_GROUPS, type PackageId, startingFrom } from '@drivebuddy/shared';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { BrandMark, Notice, SectionTitle } from '@/components/bits';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ContactActions } from '@/components/ContactActions';
import { LanguageToggle } from '@/components/LanguageToggle';
import { PackageRow } from '@/components/PackageRow';
import { Screen } from '@/components/Screen';
import { useConfig } from '@/config/ConfigProvider';
import { useI18n } from '@/i18n';
import { makeStyles, radius, space, useTheme } from '@/theme';

const bookPackage = (id?: PackageId) =>
  router.push(id ? { pathname: '/book', params: { package: id } } : '/book');

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

      {/* Hero */}
      <Card tone="hero" style={styles.hero}>
        {firstName ? (
          <AppText weight="bold" color={colors.amber}>
            {t.home.greeting(firstName)}
          </AppText>
        ) : null}
        <AppText variant="display" weight="heavy" color={colors.onHero} accessibilityRole="header">
          {t.home.title}
        </AppText>
        <AppText color={colors.onHeroMuted}>{t.home.subtitle}</AppText>
        <View style={styles.heroMeta}>
          <View style={styles.pricePill}>
            <AppText variant="small" weight="heavy" color={colors.onAmber}>
              {t.home.startingFrom(startingFrom(config))}
            </AppText>
          </View>
          <AppText variant="small" weight="bold" color={colors.onHeroMuted}>
            {t.home.cities}
          </AppText>
        </View>
        <Button title={t.common.bookDriver} icon="car" onPress={() => bookPackage()} testID="hero-book" />
      </Card>

      <ContactActions />

      {/* Services and live prices */}
      <SectionTitle>{t.home.pricesTitle}</SectionTitle>
      {PACKAGE_GROUPS.map((group) => (
        <View key={group.id} style={styles.group}>
          <AppText variant="small" weight="heavy" color={colors.textMuted}>
            {t.home.groups[group.id].toUpperCase()}
          </AppText>
          {group.packages.map((id) => (
            <PackageRow key={id} id={id} onPress={() => bookPackage(id)} />
          ))}
          {group.id === 'monthly' ? (
            <AppText variant="small" color={colors.textMuted}>
              {t.home.monthlyNote(config.monthly.hoursPerDay, config.monthly.daysOffPerMonth)}
            </AppText>
          ) : null}
        </View>
      ))}
      <AppText variant="small" color={colors.textMuted}>
        {t.home.pricesNote}
      </AppText>

      {/* Why us */}
      <SectionTitle>{t.home.trustTitle}</SectionTitle>
      <View style={styles.pillars}>
        {t.pillars.map((p) => (
          <View key={p.title} style={styles.pillar}>
            <View style={styles.pillarIcon}>
              <Ionicons name={p.icon} size={20} color={colors.amberText} />
            </View>
            <AppText weight="bold">{p.title}</AppText>
            <AppText variant="small" color={colors.textMuted}>
              {p.body}
            </AppText>
          </View>
        ))}
      </View>

      <Card tone="cream">
        <AppText variant="heading" weight="heavy">
          {t.home.helpTitle}
        </AppText>
        <AppText color={colors.textMuted}>{t.home.helpBody}</AppText>
        <ContactActions />
      </Card>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  hero: { gap: space.md, padding: space.xl },
  heroMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  pricePill: {
    backgroundColor: c.amber,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  group: { gap: space.sm },
  pillars: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  pillar: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.line,
    padding: space.md,
    gap: space.xs,
  },
  pillarIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: c.amberSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
}));

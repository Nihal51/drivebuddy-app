import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { type Category, categoryPrice } from '@/booking/categories';
import { useConfig } from '@/config/ConfigProvider';
import { useI18n } from '@/i18n';
import { makeStyles, radius, space, useTheme } from '@/theme';

import { AppText } from './AppText';

/** One service in the grid (the first booking step): icon, name, a few words and the price. Two to a row. */
export function ServiceTile({ category, onPress }: { category: Category; onPress: () => void }) {
  const { t } = useI18n();
  const { config } = useConfig();
  const { colors } = useTheme();
  const styles = useStyles();
  const c = t.categories[category.id];
  const price = categoryPrice(t, config, category);
  const urgent = category.id === 'hospital';
  return (
    <Pressable
      testID={`tile-${category.id}`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${c.name}, ${price}`}
      accessibilityHint={c.blurb}
      style={({ pressed }) => [styles.tile, urgent ? styles.urgent : null, pressed ? styles.pressed : null]}
    >
      <View style={[styles.icon, urgent ? styles.iconUrgent : null]}>
        <Ionicons name={category.icon} size={22} color={urgent ? colors.danger : colors.amberText} />
      </View>
      <View style={styles.text}>
        <AppText weight="heavy" numberOfLines={1}>
          {c.name}
        </AppText>
        <AppText variant="tiny" color={colors.textMuted} numberOfLines={1}>
          {c.blurb}
        </AppText>
      </View>
      <AppText variant="small" weight="bold" color={urgent ? colors.danger : colors.text} numberOfLines={1}>
        {price}
      </AppText>
    </Pressable>
  );
}

/** The tiles, two to a row. */
export function ServiceGrid({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return <View style={styles.grid}>{children}</View>;
}

const useStyles = makeStyles((c) => ({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm + 2 },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 116,
    padding: space.md + 2,
    borderRadius: radius.lg,
    backgroundColor: c.surface,
    justifyContent: 'space-between',
    gap: space.xs + 2,
  },
  urgent: { backgroundColor: c.dangerSoft },
  pressed: { backgroundColor: c.surfacePressed },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: c.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconUrgent: { backgroundColor: c.background },
  text: { gap: 1 },
  feature: {
    flex: 1,
    minHeight: 118,
    padding: space.md + 2,
    borderRadius: radius.lg,
    justifyContent: 'space-between',
    gap: space.sm,
  },
  featurePressed: { opacity: 0.85 },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureIconDark: { backgroundColor: 'rgba(255,255,255,0.1)' },
  featureTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.xs,
    borderBottomWidth: 1,
    borderBottomColor: c.line,
    minHeight: 64,
  },
  listRowPressed: { backgroundColor: c.surface },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconUrgent: { backgroundColor: c.dangerSoft },
  rowText: { flex: 1, gap: 1 },
}));

/**
 * One of the two big cards at the top of Home: amber for "By the hour", dark
 * for "Drop to a city". Icon, name, a few words and the price, with an arrow
 * that says "tap me".
 */
export function ServiceCard({
  category,
  tone,
  onPress,
}: {
  category: Category;
  tone: 'amber' | 'dark';
  onPress: () => void;
}) {
  const { t } = useI18n();
  const { config } = useConfig();
  const { colors } = useTheme();
  const styles = useStyles();
  const c = t.categories[category.id];
  const price = categoryPrice(t, config, category);
  const look =
    tone === 'amber'
      ? { bg: colors.amber, fg: colors.onAmber, accent: colors.onAmber }
      : { bg: colors.feature, fg: colors.onFeature, accent: colors.featureAccent };
  return (
    <Pressable
      testID={`tile-${category.id}`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${c.name}, ${price}`}
      accessibilityHint={c.blurb}
      style={({ pressed }) => [
        styles.feature,
        { backgroundColor: look.bg },
        pressed ? styles.featurePressed : null,
      ]}
    >
      <View style={styles.featureTop}>
        <View style={[styles.featureIcon, tone === 'dark' ? styles.featureIconDark : null]}>
          <Ionicons name={category.icon} size={20} color={tone === 'dark' ? look.accent : colors.onAmber} />
        </View>
        <Ionicons name="arrow-forward" size={20} color={look.fg} />
      </View>
      <View style={styles.text}>
        <AppText weight="heavy" color={look.fg} numberOfLines={1}>
          {c.name}
        </AppText>
        <AppText variant="small" weight="bold" color={look.accent} numberOfLines={1} adjustsFontSizeToFit>
          {price}
        </AppText>
      </View>
    </Pressable>
  );
}

/** A service in the "More services" list: icon, name and a few words, price, chevron. */
export function ServiceRow({ category, onPress }: { category: Category; onPress: () => void }) {
  const { t } = useI18n();
  const { config } = useConfig();
  const { colors } = useTheme();
  const styles = useStyles();
  const c = t.categories[category.id];
  const price = categoryPrice(t, config, category);
  const urgent = category.id === 'hospital';
  return (
    <Pressable
      testID={`tile-${category.id}`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${c.name}, ${price}`}
      accessibilityHint={c.blurb}
      style={({ pressed }) => [styles.listRow, pressed ? styles.listRowPressed : null]}
    >
      <View style={[styles.rowIcon, urgent ? styles.rowIconUrgent : null]}>
        <Ionicons name={category.icon} size={19} color={urgent ? colors.danger : colors.amberText} />
      </View>
      <View style={styles.rowText}>
        <AppText weight="bold" numberOfLines={1}>
          {c.name}
        </AppText>
        <AppText variant="tiny" color={colors.textMuted} numberOfLines={1}>
          {c.blurb}
        </AppText>
      </View>
      <AppText variant="small" weight="bold" color={urgent ? colors.danger : colors.text}>
        {price}
      </AppText>
      <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
    </Pressable>
  );
}

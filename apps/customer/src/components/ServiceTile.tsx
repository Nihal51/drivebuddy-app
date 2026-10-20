import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { type Category, categoryPrice } from '@/booking/categories';
import { useConfig } from '@/config/ConfigProvider';
import { useI18n } from '@/i18n';
import { makeStyles, radius, space, useTheme } from '@/theme';

import { AppText } from './AppText';

/** One service in the grid: icon, name, a few words and the price. Two to a row. */
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
}));

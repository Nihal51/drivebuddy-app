import { POPULAR_PACKAGE, type PackageId, packagePrice } from '@drivebuddy/shared';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, View } from 'react-native';

import { useConfig } from '@/config/ConfigProvider';
import { useI18n } from '@/i18n';
import { priceLabel } from '@/i18n/format';
import { makeStyles, radius, space, useTheme } from '@/theme';

import { AppText } from './AppText';

/**
 * One service with its live price. Two uses: on Home it opens the booking form
 * with this service chosen ("link"); in the form it is a radio option ("choice").
 */
export function PackageRow({
  id,
  onPress,
  mode = 'link',
  selected = false,
}: {
  id: PackageId;
  onPress: () => void;
  mode?: 'link' | 'choice';
  selected?: boolean;
}) {
  const { t } = useI18n();
  const { config } = useConfig();
  const { colors } = useTheme();
  const styles = useStyles();
  const pkg = t.packages[id];
  const price = priceLabel(t, packagePrice(config, id));
  const popular = id === POPULAR_PACKAGE;
  return (
    <Pressable
      testID={mode === 'choice' ? `choice-${id}` : `package-${id}`}
      onPress={onPress}
      accessibilityRole={mode === 'choice' ? 'radio' : 'button'}
      accessibilityState={mode === 'choice' ? { checked: selected } : undefined}
      accessibilityLabel={`${pkg.name}, ${price}`}
      accessibilityHint={pkg.blurb}
      style={({ pressed }) => [
        styles.row,
        selected ? styles.selected : null,
        pressed && !selected ? styles.pressed : null,
      ]}
    >
      {mode === 'choice' ? (
        <View style={[styles.radio, selected ? styles.radioOn : null]}>
          {selected ? <View style={styles.radioDot} /> : null}
        </View>
      ) : null}
      <View style={styles.main}>
        <View style={styles.titleRow}>
          <AppText weight="bold" style={styles.shrink}>
            {pkg.name}
          </AppText>
          {popular ? (
            <View style={styles.popular}>
              <AppText variant="tiny" weight="bold" color={colors.amberText}>
                {t.popular}
              </AppText>
            </View>
          ) : null}
        </View>
        <AppText variant="small" color={colors.textMuted}>
          {pkg.blurb}
        </AppText>
      </View>
      <View style={styles.side}>
        <AppText weight="heavy" align="right">
          {price}
        </AppText>
        {mode === 'link' ? <Ionicons name="chevron-forward" size={18} color={colors.textFaint} /> : null}
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.lg,
    paddingHorizontal: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: 'transparent',
    backgroundColor: c.surface,
    minHeight: 72,
  },
  selected: { borderColor: c.amber, backgroundColor: c.cream },
  pressed: { backgroundColor: c.surfacePressed },
  main: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  shrink: { flexShrink: 1 },
  popular: {
    backgroundColor: c.amberSoft,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 1,
  },
  side: { flexDirection: 'row', alignItems: 'center', gap: space.xs, maxWidth: '42%' },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: c.textFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: c.amberText },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.amberText },
}));

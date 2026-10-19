import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { type Palette, TOUCH, radius, space, useTheme } from '@/theme';

import { AppText } from './AppText';

export type IconName = ComponentProps<typeof Ionicons>['name'];

type Variant = 'primary' | 'dark' | 'outline' | 'ghost' | 'whatsapp';

const look = (c: Palette, variant: Variant): { bg: string; pressed: string; fg: string; border?: string } => {
  switch (variant) {
    case 'primary':
      return { bg: c.amber, pressed: c.amberPressed, fg: c.onAmber };
    case 'dark':
      return { bg: c.inverse, pressed: c.inversePressed, fg: c.onInverse };
    case 'outline':
      return { bg: c.surface, pressed: c.amberSoft, fg: c.text, border: c.line };
    case 'ghost':
      return { bg: 'transparent', pressed: c.amberSoft, fg: c.amberText };
    case 'whatsapp':
      return { bg: c.whatsapp, pressed: c.whatsappPressed, fg: c.onWhatsapp };
  }
};

export type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: Variant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  compact?: boolean;
  style?: ViewStyle;
  accessibilityHint?: string;
  testID?: string;
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  compact = false,
  style,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const { colors } = useTheme();
  const l = look(colors, variant);
  const inactive = disabled || loading;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      hitSlop={compact ? 6 : 0}
      style={({ pressed }) => [
        styles.base,
        compact ? styles.compact : null,
        {
          backgroundColor: pressed ? l.pressed : l.bg,
          borderColor: l.border ?? 'transparent',
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator color={l.fg} />
        ) : icon ? (
          <Ionicons name={icon} size={compact ? 18 : 20} color={l.fg} />
        ) : null}
        <AppText variant={compact ? 'small' : 'body'} weight="bold" color={l.fg} numberOfLines={1}>
          {title}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: TOUCH,
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
  },
  compact: { minHeight: 40, paddingHorizontal: space.md, borderRadius: radius.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
});

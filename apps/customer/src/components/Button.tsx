import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { TOUCH, colors, radius, space } from '@/theme';

import { AppText } from './AppText';

export type IconName = ComponentProps<typeof Ionicons>['name'];

type Variant = 'primary' | 'dark' | 'outline' | 'ghost' | 'whatsapp';

const LOOK: Record<Variant, { bg: string; pressed: string; fg: string; border?: string }> = {
  primary: { bg: colors.amber, pressed: colors.amberPressed, fg: colors.ink },
  dark: { bg: colors.ink, pressed: colors.inkSoft, fg: colors.white },
  outline: { bg: colors.white, pressed: colors.amberSoft, fg: colors.text, border: colors.line },
  ghost: { bg: 'transparent', pressed: colors.amberSoft, fg: colors.amberText },
  whatsapp: { bg: colors.whatsapp, pressed: '#1ebe5b', fg: '#06281f' },
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
  const look = LOOK[variant];
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
          backgroundColor: pressed ? look.pressed : look.bg,
          borderColor: look.border ?? 'transparent',
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator color={look.fg} />
        ) : icon ? (
          <Ionicons name={icon} size={compact ? 18 : 20} color={look.fg} />
        ) : null}
        <AppText variant={compact ? 'small' : 'body'} weight="bold" color={look.fg} numberOfLines={1}>
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

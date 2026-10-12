import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { colors, radius, shadow, space } from '@/theme';

export function Card({
  children,
  tone = 'white',
  style,
}: {
  children: ReactNode;
  tone?: 'white' | 'cream' | 'dark';
  style?: ViewStyle;
}) {
  return <View style={[styles.base, TONES[tone], style]}>{children}</View>;
}

const TONES: Record<'white' | 'cream' | 'dark', ViewStyle> = {
  white: { backgroundColor: colors.white, borderColor: colors.line, ...shadow.card },
  cream: { backgroundColor: colors.cream, borderColor: colors.creamLine },
  dark: { backgroundColor: colors.ink, borderColor: colors.ink },
};

const styles = StyleSheet.create({
  base: { borderRadius: radius.lg, borderWidth: 1, padding: space.lg, gap: space.md },
});

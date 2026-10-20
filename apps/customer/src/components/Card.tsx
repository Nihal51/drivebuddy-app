import type { ReactNode } from 'react';
import type { ViewStyle } from 'react-native';
import { View } from 'react-native';

import { makeStyles, radius, space } from '@/theme';

type Tone = 'surface' | 'cream' | 'hero';

export function Card({
  children,
  tone = 'surface',
  style,
}: {
  children: ReactNode;
  tone?: Tone;
  style?: ViewStyle;
}) {
  const styles = useStyles();
  return <View style={[styles.base, styles[tone], style]}>{children}</View>;
}

const useStyles = makeStyles((c) => ({
  base: { borderRadius: radius.lg, padding: space.lg, gap: space.md },
  surface: { backgroundColor: c.surface },
  cream: { backgroundColor: c.cream },
  hero: { backgroundColor: c.hero },
}));

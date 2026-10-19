import type { ReactNode } from 'react';
import type { ViewStyle } from 'react-native';
import { View } from 'react-native';

import { cardShadow, makeStyles, radius, space } from '@/theme';

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
  base: { borderRadius: radius.lg, borderWidth: 1, padding: space.lg, gap: space.md },
  surface: { backgroundColor: c.surface, borderColor: c.line, ...cardShadow(c) },
  cream: { backgroundColor: c.cream, borderColor: c.creamLine },
  hero: { backgroundColor: c.hero, borderColor: c.hero === c.surface ? c.line : c.hero },
}));

/**
 * DriveBuddy's look: a white canvas, soft grey surfaces with no borders, one
 * amber accent for actions, Plus Jakarta Sans — in a light and a dark version
 * that follows the phone's setting. Calm on purpose: one main action per
 * screen, and colour only where it means something. One place for every colour, size and spacing value: no screen types
 * a hex code of its own.
 *
 * Colours come from `useTheme()`; styles that use colours are made with
 * `makeStyles`, which builds each style sheet once per palette.
 */

import { type ReactNode, createContext, useContext, useMemo } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';

const light = {
  /** Page background. */
  background: '#ffffff',
  /** Cards, tiles, inputs: soft grey on the white page, no border. */
  surface: '#f5f5f4',
  /** Pressed surface. */
  surfacePressed: '#ebeae8',
  /** The tab bar, header and pinned footers. */
  bar: '#ffffff',
  text: '#18181b',
  textMuted: '#57534e',
  textFaint: '#78716c',
  line: '#ececea',
  amber: '#f59e0b',
  amberPressed: '#d97706',
  /** Amber dark enough to read as text on the surface (WCAG AA). */
  amberText: '#b45309',
  amberSoft: '#fef3c7',
  /** Text and icons on amber. */
  onAmber: '#141210',
  /** Warm highlighted panels. */
  cream: '#fffbeb',
  creamLine: '#fde68a',
  /** The dark hero card on Home. */
  hero: '#141210',
  /** The dark service card on Home ("Drop to a city"), and its text and accent. */
  feature: '#18181b',
  onFeature: '#ffffff',
  featureAccent: '#fbbf24',
  onHero: '#ffffff',
  onHeroMuted: '#d6d3d1',
  /** Strong buttons (e.g. "Continue with Google"): ink on light, light on dark. */
  inverse: '#141210',
  inversePressed: '#292524',
  onInverse: '#ffffff',
  white: '#ffffff',
  success: '#15803d',
  successSoft: '#dcfce7',
  /** Filled success shapes that carry a white tick. */
  successSolid: '#15803d',
  danger: '#b91c1c',
  dangerSoft: '#fee2e2',
  info: '#1d4ed8',
  infoSoft: '#dbeafe',
  whatsapp: '#25d366',
  whatsappPressed: '#1ebe5b',
  onWhatsapp: '#06281f',
  shadow: '#1c1917',
};

export type Palette = typeof light;

const dark: Palette = {
  background: '#0c0a09',
  surface: '#1c1917',
  surfacePressed: '#292524',
  bar: '#0c0a09',
  text: '#fafaf9',
  textMuted: '#d6d3d1',
  textFaint: '#a8a29e',
  line: '#353029',
  amber: '#f59e0b',
  amberPressed: '#fbbf24',
  amberText: '#fbbf24',
  amberSoft: '#3a2c0c',
  onAmber: '#141210',
  cream: '#1f1a10',
  creamLine: '#4a3b17',
  hero: '#1c1917',
  feature: '#292524',
  onFeature: '#ffffff',
  featureAccent: '#fbbf24',
  onHero: '#ffffff',
  onHeroMuted: '#d6d3d1',
  inverse: '#fafaf9',
  inversePressed: '#e7e5e4',
  onInverse: '#141210',
  white: '#ffffff',
  success: '#4ade80',
  successSoft: '#12301d',
  successSolid: '#15803d',
  danger: '#f87171',
  dangerSoft: '#3b1414',
  info: '#93c5fd',
  infoSoft: '#172554',
  whatsapp: '#25d366',
  whatsappPressed: '#1ebe5b',
  onWhatsapp: '#06281f',
  shadow: '#000000',
};

export const palettes = { light, dark } as const;
export type Scheme = keyof typeof palettes;

type Theme = { scheme: Scheme; colors: Palette };

const ThemeContext = createContext<Theme>({ scheme: 'light', colors: light });

/** Follows the phone's light/dark setting; `scheme` pins one (tests, previews). */
export function ThemeProvider({ children, scheme }: { children: ReactNode; scheme?: Scheme }) {
  const system = useColorScheme();
  const active: Scheme = scheme ?? (system === 'dark' ? 'dark' : 'light');
  const value = useMemo(() => ({ scheme: active, colors: palettes[active] }), [active]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** The active palette. Works outside the provider too (light), e.g. on the crash screen. */
export const useTheme = () => useContext(ThemeContext);

/**
 * `const useStyles = makeStyles((c) => ({ card: { backgroundColor: c.surface } }))`
 * then `const styles = useStyles()` in the component: built once per palette.
 */
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(factory: (c: Palette) => T): () => T {
  const cache = new Map<Palette, T>();
  return function useStyles() {
    const { colors } = useTheme();
    let styles = cache.get(colors);
    if (!styles) {
      styles = StyleSheet.create(factory(colors));
      cache.set(colors, styles);
    }
    return styles;
  };
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const;

/** Minimum touch target (Android 48dp, iOS 44pt). */
export const TOUCH = 48;

/**
 * Plus Jakarta Sans for English. It has no Devanagari letters, so Hindi uses
 * the phone's own font (Noto Sans Devanagari on Android) at the same weights —
 * see components/AppText.tsx.
 */
export const fonts = {
  regular: 'PlusJakartaSans_500Medium',
  medium: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  heavy: 'PlusJakartaSans_800ExtraBold',
} as const;

export type Weight = keyof typeof fonts;

export const fontWeights: Record<Weight, '500' | '600' | '700' | '800'> = {
  regular: '500',
  medium: '600',
  bold: '700',
  heavy: '800',
};

export const type = {
  display: { fontSize: 28, lineHeight: 34 },
  title: { fontSize: 22, lineHeight: 28 },
  heading: { fontSize: 18, lineHeight: 24 },
  body: { fontSize: 16, lineHeight: 23 },
  small: { fontSize: 14, lineHeight: 20 },
  tiny: { fontSize: 12, lineHeight: 16 },
} as const;

export type TypeScale = keyof typeof type;

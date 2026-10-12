/**
 * DriveBuddy's look, taken from the website: amber on ink, warm cream panels,
 * Plus Jakarta Sans. One place for every colour, size and spacing value — no
 * screen types a hex code of its own.
 */

export const colors = {
  ink: '#141210',
  inkSoft: '#292524',
  text: '#18181b',
  textMuted: '#57534e',
  textFaint: '#78716c',
  amber: '#f59e0b',
  amberPressed: '#d97706',
  /** Amber dark enough for text on white (WCAG AA). */
  amberText: '#b45309',
  amberSoft: '#fef3c7',
  cream: '#fffbeb',
  creamLine: '#fde68a',
  white: '#ffffff',
  background: '#fafaf9',
  line: '#e7e5e4',
  success: '#15803d',
  successSoft: '#dcfce7',
  danger: '#b91c1c',
  dangerSoft: '#fee2e2',
  info: '#1d4ed8',
  infoSoft: '#dbeafe',
  whatsapp: '#25d366',
  whatsappText: '#075e54',
} as const;

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
  display: { fontSize: 30, lineHeight: 36 },
  title: { fontSize: 22, lineHeight: 28 },
  heading: { fontSize: 18, lineHeight: 24 },
  body: { fontSize: 16, lineHeight: 23 },
  small: { fontSize: 14, lineHeight: 20 },
  tiny: { fontSize: 12, lineHeight: 16 },
} as const;

export type TypeScale = keyof typeof type;

export const shadow = {
  card: {
    shadowColor: '#1c1917',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
} as const;

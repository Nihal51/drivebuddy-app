/**
 * All text in the app. Picks the brand font for English and the phone's
 * Devanagari font for Hindi (Plus Jakarta Sans has no Hindi letters), and caps
 * how far the phone's "large text" setting can grow it so layouts never break
 * while still honouring the setting.
 */

import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { useOptionalLang } from '@/i18n';
import { type TypeScale, type Weight, colors, fontWeights, fonts, type as scale } from '@/theme';

export type AppTextProps = TextProps & {
  variant?: TypeScale;
  weight?: Weight;
  color?: string;
  align?: TextStyle['textAlign'];
};

export function AppText({
  variant = 'body',
  weight = 'regular',
  color = colors.text,
  align,
  style,
  ...rest
}: AppTextProps) {
  const lang = useOptionalLang();
  // Brand font for English; the phone's own font for Hindi, and on the crash
  // screen (outside the providers, where the brand font may not have loaded).
  const face: TextStyle = lang === 'en' ? { fontFamily: fonts[weight] } : { fontWeight: fontWeights[weight] };
  // Devanagari needs a little more line height for its upper and lower marks.
  const size = scale[variant];
  const lineHeight = lang === 'hi' ? Math.round(size.lineHeight * 1.12) : size.lineHeight;
  return (
    <Text
      maxFontSizeMultiplier={1.4}
      style={[styles.base, size, { lineHeight, color }, face, align ? { textAlign: align } : null, style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: { letterSpacing: -0.1 },
});

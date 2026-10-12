import { forwardRef, useState } from 'react';
import { StyleSheet, TextInput, type TextInputProps, View } from 'react-native';

import { useOptionalLang } from '@/i18n';
import { TOUCH, colors, fonts, radius, space, type as scale } from '@/theme';

import { AppText } from './AppText';

export type TextFieldProps = Omit<TextInputProps, 'style'> & {
  label: string;
  error?: string;
  hint?: string;
  optionalLabel?: string;
  /** Fixed text before the input, e.g. "+91". */
  prefix?: string;
};

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, hint, optionalLabel, prefix, multiline, onFocus, onBlur, ...input },
  ref,
) {
  const lang = useOptionalLang();
  const [focused, setFocused] = useState(false);
  const border = error ? colors.danger : focused ? colors.amber : colors.line;
  return (
    <View style={styles.wrap}>
      <AppText variant="small" weight="bold">
        {label}
        {optionalLabel ? (
          <AppText variant="small" color={colors.textFaint}>
            {` (${optionalLabel})`}
          </AppText>
        ) : null}
      </AppText>
      <View style={[styles.box, { borderColor: border }, multiline ? styles.multiBox : null]}>
        {prefix ? (
          <AppText weight="medium" color={colors.textMuted} style={styles.prefix}>
            {prefix}
          </AppText>
        ) : null}
        <TextInput
          ref={ref}
          multiline={multiline}
          placeholderTextColor={colors.textFaint}
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          maxFontSizeMultiplier={1.4}
          style={[
            styles.input,
            lang === 'en' ? { fontFamily: fonts.regular } : { fontWeight: '500' },
            multiline ? styles.multiInput : null,
          ]}
          {...input}
        />
      </View>
      {error ? (
        <AppText variant="small" color={colors.danger} accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="small" color={colors.textMuted}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: space.xs + 2 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TOUCH + 4,
    borderWidth: 1.5,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    paddingHorizontal: space.md,
  },
  multiBox: { alignItems: 'flex-start', paddingVertical: space.sm },
  prefix: { marginRight: space.sm },
  input: { flex: 1, fontSize: scale.body.fontSize, color: colors.text, paddingVertical: space.sm },
  multiInput: { minHeight: 84, textAlignVertical: 'top' },
});

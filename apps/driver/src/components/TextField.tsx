import { forwardRef, useRef, useState } from 'react';
import { TextInput, type TextInputProps, View } from 'react-native';

import { useOptionalLang } from '@/i18n';
import { TOUCH, fonts, makeStyles, radius, space, type as scale, useTheme } from '@/theme';

import { AppText } from './AppText';
import { useReveal } from './Screen';

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
  const { colors, scheme } = useTheme();
  const styles = useStyles();
  const [focused, setFocused] = useState(false);
  // Inside a Screen: scroll this field (label and all) into view above the keyboard.
  const reveal = useReveal();
  const wrap = useRef<View>(null);
  const border = error ? colors.danger : focused ? colors.amber : 'transparent';
  return (
    <View ref={wrap} style={styles.wrap}>
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
          selectionColor={colors.amber}
          keyboardAppearance={scheme}
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          onFocus={(e) => {
            setFocused(true);
            reveal?.(wrap.current);
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

const useStyles = makeStyles((c) => ({
  wrap: { gap: space.xs + 2 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TOUCH + 4,
    borderWidth: 1.5,
    borderRadius: radius.lg,
    backgroundColor: c.surface,
    paddingHorizontal: space.md,
  },
  multiBox: { alignItems: 'flex-start', paddingVertical: space.sm },
  prefix: { marginRight: space.sm },
  input: { flex: 1, fontSize: scale.body.fontSize, color: c.text, paddingVertical: space.sm },
  multiInput: { minHeight: 84, textAlignVertical: 'top' },
}));

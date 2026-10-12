import { LANGUAGES, type Language } from '@drivebuddy/shared';
import { Pressable, StyleSheet, View } from 'react-native';

import { MESSAGES, useI18n } from '@/i18n';
import { colors, radius, space } from '@/theme';

import { AppText } from './AppText';

/** English | हिंदी. Each option is written in its own language so anyone can find theirs. */
export function LanguageToggle({ size = 'normal' }: { size?: 'small' | 'normal' }) {
  const { lang, setLang } = useI18n();
  return (
    <View style={[styles.wrap, size === 'small' ? styles.small : null]} accessibilityRole="radiogroup">
      {LANGUAGES.map((l: Language) => {
        const selected = l === lang;
        return (
          <Pressable
            key={l}
            onPress={() => setLang(l)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={MESSAGES[l].languageName}
            hitSlop={4}
            style={[
              styles.option,
              size === 'small' ? styles.optionSmall : null,
              selected ? styles.selected : null,
            ]}
          >
            <AppText
              variant={size === 'small' ? 'tiny' : 'small'}
              weight="bold"
              color={selected ? colors.ink : colors.textMuted}
            >
              {MESSAGES[l].languageName}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 3,
    alignSelf: 'flex-start',
  },
  small: {},
  option: { minHeight: 40, paddingHorizontal: space.lg, borderRadius: radius.pill, justifyContent: 'center' },
  optionSmall: { minHeight: 32, paddingHorizontal: space.md },
  selected: { backgroundColor: colors.amber },
});

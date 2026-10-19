import { LANGUAGES, type Language } from '@drivebuddy/shared';
import { Pressable, View } from 'react-native';

import { MESSAGES, useI18n } from '@/i18n';
import { makeStyles, radius, space, useTheme } from '@/theme';

import { AppText } from './AppText';

/** English | हिंदी. Each option is written in its own language so anyone can find theirs. */
export function LanguageToggle({ size = 'normal' }: { size?: 'small' | 'normal' }) {
  const { lang, setLang } = useI18n();
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.wrap} accessibilityRole="radiogroup">
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
              color={selected ? colors.onAmber : colors.textMuted}
            >
              {MESSAGES[l].languageName}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: {
    flexDirection: 'row',
    backgroundColor: c.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.line,
    padding: 3,
    alignSelf: 'flex-start',
  },
  option: { minHeight: 40, paddingHorizontal: space.lg, borderRadius: radius.pill, justifyContent: 'center' },
  optionSmall: { minHeight: 32, paddingHorizontal: space.md },
  selected: { backgroundColor: c.amber },
}));

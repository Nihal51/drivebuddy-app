import { Pressable } from 'react-native';

import { makeStyles, radius, space, useTheme } from '@/theme';

import { AppText } from './AppText';

/** A choice in a row of choices (city, day, time). Announced as a radio button. */
export function Chip({
  label,
  selected,
  onPress,
  sublabel,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  sublabel?: string;
  testID?: string;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={sublabel ? `${label}, ${sublabel}` : label}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.selected : null,
        pressed && !selected ? styles.pressed : null,
      ]}
    >
      <AppText variant="small" weight="bold" color={selected ? colors.onAmber : colors.text} align="center">
        {label}
      </AppText>
      {sublabel ? (
        <AppText
          variant="tiny"
          weight="medium"
          color={selected ? colors.onAmber : colors.textMuted}
          align="center"
        >
          {sublabel}
        </AppText>
      ) : null}
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  chip: {
    minHeight: 44,
    minWidth: 64,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: c.line,
    backgroundColor: c.surface,
    justifyContent: 'center',
  },
  selected: { backgroundColor: c.amber, borderColor: c.amber },
  pressed: { backgroundColor: c.amberSoft },
}));

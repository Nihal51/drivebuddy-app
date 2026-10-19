import { dayOptions, timeSlots } from '@drivebuddy/shared';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Chip } from '@/components/Chip';
import { useI18n } from '@/i18n';
import { formatSlot } from '@/i18n/format';
import { space, useTheme } from '@/theme';

export type When = { mode: 'asap' } | { mode: 'schedule'; day: string; slot: string | null };

/**
 * "As soon as possible", or a day in the next week and a half-hour slot.
 * Chips instead of a native date picker: one tap each, the same on every
 * phone, and no past or impossible times to choose.
 */
export function WhenPicker({
  value,
  onChange,
  now,
  error,
}: {
  value: When;
  onChange: (next: When) => void;
  now: number;
  error?: string;
}) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const days = useMemo(() => dayOptions(now, 7), [now]);
  const firstDayWithSlots = days.find((d) => timeSlots(d.key, now).length > 0)?.key ?? days[1]?.key ?? '';
  const day = value.mode === 'schedule' ? value.day : firstDayWithSlots;
  const slots = useMemo(() => timeSlots(day, now), [day, now]);

  return (
    <View style={styles.wrap}>
      <AppText variant="small" weight="bold">
        {t.book.when}
      </AppText>
      <View style={styles.row} accessibilityRole="radiogroup">
        <Chip
          label={t.book.asap}
          selected={value.mode === 'asap'}
          onPress={() => onChange({ mode: 'asap' })}
        />
        <Chip
          label={t.book.schedule}
          selected={value.mode === 'schedule'}
          onPress={() => onChange({ mode: 'schedule', day, slot: null })}
          testID="when-schedule"
        />
      </View>

      {value.mode === 'schedule' ? (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scroller}
          >
            {days.map((d) => (
              <Chip
                key={d.key}
                label={
                  d.offset === 0
                    ? t.book.today
                    : d.offset === 1
                      ? t.book.tomorrow
                      : (t.dates.weekdays[d.parts.weekday] ?? '')
                }
                sublabel={`${d.parts.day} ${t.dates.months[d.parts.month - 1] ?? ''}`}
                selected={d.key === value.day}
                onPress={() => onChange({ mode: 'schedule', day: d.key, slot: null })}
              />
            ))}
          </ScrollView>
          {slots.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.scroller}
            >
              {slots.map((s) => (
                <Chip
                  key={s}
                  label={formatSlot(t, s)}
                  selected={s === value.slot}
                  onPress={() => onChange({ mode: 'schedule', day: value.day, slot: s })}
                  testID={`slot-${s}`}
                />
              ))}
            </ScrollView>
          ) : (
            <AppText variant="small" color={colors.textMuted}>
              {t.book.noSlotsToday}
            </AppText>
          )}
        </>
      ) : null}

      {error ? (
        <AppText variant="small" color={colors.danger} accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  scroller: { gap: space.sm, paddingVertical: 2, paddingRight: space.lg },
});

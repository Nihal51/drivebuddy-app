import { type BookingStatus, STATUS_STEPS } from '@drivebuddy/shared';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { useI18n } from '@/i18n';
import { colors, space } from '@/theme';

import { AppText } from './AppText';

/** Received → Confirmed → Driver assigned → Completed, with the current step highlighted. */
export function StatusTracker({ status }: { status: BookingStatus }) {
  const { t } = useI18n();
  const current = STATUS_STEPS.indexOf(status);
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={t.status[status].label} style={styles.wrap}>
      {STATUS_STEPS.map((step, i) => {
        const done = i < current || status === 'completed';
        const active = i === current && status !== 'completed';
        const last = i === STATUS_STEPS.length - 1;
        return (
          <View key={step} style={styles.row}>
            <View style={styles.rail}>
              <View style={[styles.dot, done ? styles.dotDone : active ? styles.dotActive : styles.dotTodo]}>
                {done ? <Ionicons name="checkmark" size={14} color={colors.white} /> : null}
              </View>
              {!last ? <View style={[styles.line, done ? styles.lineDone : null]} /> : null}
            </View>
            <View style={styles.text}>
              <AppText
                weight={active ? 'heavy' : 'bold'}
                color={done || active ? colors.text : colors.textFaint}
              >
                {t.status[step].label}
              </AppText>
              {active ? (
                <AppText variant="small" color={colors.textMuted}>
                  {t.status[step].detail}
                </AppText>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const DOT = 24;
const styles = StyleSheet.create({
  wrap: { gap: 0 },
  row: { flexDirection: 'row', gap: space.md, minHeight: 52 },
  rail: { width: DOT, alignItems: 'center' },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, alignItems: 'center', justifyContent: 'center' },
  dotDone: { backgroundColor: colors.success },
  dotActive: { backgroundColor: colors.amber, borderWidth: 4, borderColor: colors.amberSoft },
  dotTodo: { backgroundColor: colors.white, borderWidth: 2, borderColor: colors.line },
  line: { flex: 1, width: 2, backgroundColor: colors.line, marginVertical: 2 },
  lineDone: { backgroundColor: colors.success },
  text: { flex: 1, paddingBottom: space.md, gap: 2 },
});

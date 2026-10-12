import type { BookingStatus } from '@drivebuddy/shared';
import { StyleSheet, View } from 'react-native';

import { useI18n } from '@/i18n';
import { colors, radius, space } from '@/theme';

import { AppText } from './AppText';

const TONE: Record<BookingStatus, { bg: string; fg: string }> = {
  new: { bg: colors.amberSoft, fg: colors.amberText },
  confirmed: { bg: colors.infoSoft, fg: colors.info },
  assigned: { bg: colors.infoSoft, fg: colors.info },
  completed: { bg: colors.successSoft, fg: colors.success },
  cancelled: { bg: colors.line, fg: colors.textMuted },
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  const { t } = useI18n();
  const tone = TONE[status];
  return (
    <View style={[styles.badge, { backgroundColor: tone.bg }]}>
      <AppText variant="tiny" weight="bold" color={tone.fg}>
        {t.status[status].label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: space.sm + 2,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
});

import type { BookingStatus } from '@drivebuddy/shared';
import { StyleSheet, View } from 'react-native';

import { useI18n } from '@/i18n';
import { type Palette, radius, space, useTheme } from '@/theme';

import { AppText } from './AppText';

const tone = (c: Palette, status: BookingStatus): { bg: string; fg: string } => {
  switch (status) {
    case 'new':
      return { bg: c.amberSoft, fg: c.amberText };
    case 'confirmed':
    case 'assigned':
      return { bg: c.infoSoft, fg: c.info };
    case 'completed':
      return { bg: c.successSoft, fg: c.success };
    case 'cancelled':
      return { bg: c.line, fg: c.textMuted };
  }
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const look = tone(colors, status);
  return (
    <View style={[styles.badge, { backgroundColor: look.bg }]}>
      <AppText variant="tiny" weight="bold" color={look.fg}>
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

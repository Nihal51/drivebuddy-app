/** Small building blocks used on several screens. */

import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Image, View } from 'react-native';

import { makeStyles, radius, space, useTheme } from '@/theme';

import { AppText } from './AppText';
import type { IconName } from './Button';

export function SectionTitle({ children, action }: { children: string; action?: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.sectionRow}>
      <AppText variant="heading" weight="heavy" accessibilityRole="header" style={styles.flex}>
        {children}
      </AppText>
      {action}
    </View>
  );
}

/** The DB logo + wordmark, as on the website header. */
export function BrandMark() {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.brand} accessible accessibilityLabel="DriveBuddy">
      <View style={styles.logoTile}>
        <Image source={require('../../assets/images/logo.png')} style={styles.logo} resizeMode="contain" />
      </View>
      <AppText variant="heading" weight="heavy">
        Drive
        <AppText variant="heading" weight="heavy" color={colors.amberText}>
          Buddy
        </AppText>
      </AppText>
    </View>
  );
}

export function Notice({ text, tone = 'amber' }: { text: string; tone?: 'amber' | 'grey' | 'danger' }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const look =
    tone === 'danger'
      ? { bg: colors.dangerSoft, fg: colors.danger, icon: 'alert-circle' as const }
      : tone === 'grey'
        ? { bg: colors.line, fg: colors.textMuted, icon: 'information-circle' as const }
        : { bg: colors.amberSoft, fg: colors.text, icon: 'megaphone' as const };
  return (
    <View style={[styles.notice, { backgroundColor: look.bg }]} accessibilityRole="alert">
      <Ionicons name={look.icon} size={18} color={look.fg} />
      <AppText variant="small" weight="medium" color={look.fg} style={styles.flex}>
        {text}
      </AppText>
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  children,
}: {
  icon: IconName;
  title: string;
  body?: string;
  children?: ReactNode;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={30} color={colors.amberText} />
      </View>
      <AppText variant="title" weight="heavy" align="center">
        {title}
      </AppText>
      {body ? (
        <AppText color={colors.textMuted} align="center">
          {body}
        </AppText>
      ) : null}
      {children ? <View style={styles.emptyActions}>{children}</View> : null}
    </View>
  );
}

/** "Label ........ value" line on the booking detail. */
export function InfoRow({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.info}>
      <Ionicons name={icon} size={18} color={colors.textMuted} style={styles.infoIcon} />
      <View style={styles.flex}>
        <AppText variant="tiny" weight="bold" color={colors.textMuted}>
          {label.toUpperCase()}
        </AppText>
        <AppText selectable>{value}</AppText>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  // The logo's black "D" needs a light tile to show on the dark theme.
  logoTile: { backgroundColor: '#ffffff', borderRadius: radius.sm, padding: 3 },
  logo: { width: 43, height: 36 },
  notice: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'flex-start',
    padding: space.md,
    borderRadius: radius.md,
  },
  empty: { alignItems: 'center', gap: space.md, paddingVertical: space.xl, paddingHorizontal: space.md },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: c.amberSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyActions: { alignSelf: 'stretch', gap: space.sm, marginTop: space.sm },
  info: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  infoIcon: { marginTop: 2 },
}));

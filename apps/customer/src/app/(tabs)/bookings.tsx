import { type Booking, isActive } from '@drivebuddy/shared';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { GoogleButton } from '@/components/GoogleButton';
import { AppText } from '@/components/AppText';
import { EmptyState, Notice, SectionTitle } from '@/components/bits';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { StatusBadge } from '@/components/StatusBadge';
import { watchMyBookings } from '@/data/bookings';
import { useI18n } from '@/i18n';
import { bookingTitle, formatPreferred } from '@/i18n/format';
import { colors, radius, shadow, space } from '@/theme';

export default function BookingsScreen() {
  const { t } = useI18n();
  const { ready, user } = useAuth();
  // Results are tagged with the login and attempt they belong to, so a stale
  // list or error never shows after logging out or pulling to refresh.
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; list: Booking[] | null; failed: boolean } | null>(null);
  const key = `${user?.uid ?? ''}:${attempt}`;

  useEffect(() => {
    if (!user) return;
    const k = `${user.uid}:${attempt}`;
    return watchMyBookings(
      user.uid,
      (list) => setResult({ key: k, list, failed: false }),
      () => setResult((r) => ({ key: k, list: r?.key === k ? r.list : null, failed: true })),
    );
  }, [user, attempt]);

  const bookings = result?.key === key ? result.list : null;
  const failed = result?.key === key && result.failed;

  if (!ready) return <Loading />;

  if (!user) {
    return (
      <Screen>
        <AppText variant="title" weight="heavy" accessibilityRole="header">
          {t.bookings.title}
        </AppText>
        <EmptyState icon="receipt-outline" title={t.bookings.signedOutTitle} body={t.bookings.signedOutBody}>
          <GoogleButton />
        </EmptyState>
        <AppText variant="small" color={colors.textMuted} align="center">
          {t.bookings.guestNote}
        </AppText>
      </Screen>
    );
  }

  const current = bookings?.filter(isActive) ?? [];
  const past = bookings?.filter((b) => !isActive(b)) ?? [];

  return (
    <Screen refreshing={false} onRefresh={() => setAttempt((n) => n + 1)}>
      <AppText variant="title" weight="heavy" accessibilityRole="header">
        {t.bookings.title}
      </AppText>
      {failed ? <Notice text={t.bookings.loadError} tone="danger" /> : null}
      {bookings === null && !failed ? (
        <ActivityIndicator color={colors.amber} style={styles.spinner} />
      ) : null}
      {bookings?.length === 0 ? (
        <EmptyState icon="car-outline" title={t.bookings.empty} body={t.bookings.emptyBody}>
          <Button title={t.common.bookDriver} icon="car" onPress={() => router.push('/book')} />
        </EmptyState>
      ) : null}
      {current.length ? (
        <View style={styles.section}>
          <SectionTitle>{t.bookings.current}</SectionTitle>
          {current.map((b) => (
            <BookingCard key={b.id} booking={b} />
          ))}
        </View>
      ) : null}
      {past.length ? (
        <View style={styles.section}>
          <SectionTitle>{t.bookings.past}</SectionTitle>
          {past.map((b) => (
            <BookingCard key={b.id} booking={b} />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

function BookingCard({ booking: b }: { booking: Booking }) {
  const { t } = useI18n();
  const title = bookingTitle(t, b);
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/booking/[id]', params: { id: b.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${t.status[b.status].label}, ${formatPreferred(t, b.preferredTime)}`}
      style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}
    >
      <View style={styles.cardTop}>
        <View style={styles.flex}>
          <AppText weight="heavy">{title}</AppText>
          <AppText variant="tiny" weight="bold" color={colors.textFaint}>
            {b.ref ?? t.bookings.numbering}
          </AppText>
        </View>
        <StatusBadge status={b.status} />
      </View>
      <View style={styles.line}>
        <Ionicons name="time-outline" size={16} color={colors.textMuted} />
        <AppText variant="small" color={colors.textMuted}>
          {formatPreferred(t, b.preferredTime)}
        </AppText>
      </View>
      <View style={styles.line}>
        <Ionicons name="location-outline" size={16} color={colors.textMuted} />
        <AppText variant="small" color={colors.textMuted} numberOfLines={1} style={styles.flex}>
          {b.pickup}
        </AppText>
      </View>
      {b.status === 'assigned' && b.assignedDriver ? (
        <View style={styles.line}>
          <Ionicons name="person-circle-outline" size={16} color={colors.info} />
          <AppText variant="small" weight="bold" color={colors.info}>
            {b.assignedDriver.name}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

function Loading() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.amber} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  spinner: { marginTop: space.xl },
  section: { gap: space.sm },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.lg,
    gap: space.sm,
    ...shadow.card,
  },
  cardPressed: { backgroundColor: colors.cream },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});

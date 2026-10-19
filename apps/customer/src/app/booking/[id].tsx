import { type Booking, prettyPhone, rupees } from '@drivebuddy/shared';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { EmptyState, InfoRow, Notice } from '@/components/bits';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ContactActions } from '@/components/ContactActions';
import { GoogleButton } from '@/components/GoogleButton';
import { Screen } from '@/components/Screen';
import { StatusBadge } from '@/components/StatusBadge';
import { StatusTracker } from '@/components/StatusTracker';
import { useConfig } from '@/config/ConfigProvider';
import { watchBooking } from '@/data/bookings';
import { useI18n } from '@/i18n';
import { bookingTitle, formatDateTime, formatPreferred, quoteBreakdown, tripSummary } from '@/i18n/format';
import { callNumber, openWebPage } from '@/lib/links';
import { makeStyles, space, useTheme } from '@/theme';

type State = { kind: 'loading' } | { kind: 'missing' } | { kind: 'ready'; booking: Booking };

export default function BookingDetailScreen() {
  const { t } = useI18n();
  const { config } = useConfig();
  const { ready, user } = useAuth();
  const { colors } = useTheme();
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    if (!user || !id) return;
    return watchBooking(
      id,
      (b) => setState(b ? { kind: 'ready', booking: b } : { kind: 'missing' }),
      () => setState({ kind: 'missing' }), // permission denied = not this customer's booking
    );
  }, [id, user]);

  if (!ready || (user && state.kind === 'loading')) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.amber} size="large" />
      </View>
    );
  }

  // Opened from a notification while logged out: log in first.
  if (!user) {
    return (
      <Screen edges={['bottom']}>
        <EmptyState
          icon="lock-closed-outline"
          title={t.bookings.signedOutTitle}
          body={t.bookings.signedOutBody}
        >
          <GoogleButton />
        </EmptyState>
      </Screen>
    );
  }

  if (state.kind !== 'ready') {
    return (
      <Screen edges={['bottom']}>
        <EmptyState icon="help-circle-outline" title={t.detail.notFound}>
          <ContactActions />
        </EmptyState>
      </Screen>
    );
  }

  const b = state.booking;
  const ref = b.ref ?? t.bookings.numbering;
  const title = bookingTitle(t, b);

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: b.ref ?? t.detail.title }} />

      <View style={styles.head}>
        <View style={styles.flex}>
          <AppText variant="title" weight="heavy" accessibilityRole="header">
            {title}
          </AppText>
          <AppText variant="small" weight="bold" color={colors.textFaint}>
            {t.detail.reference}: {ref}
          </AppText>
        </View>
        <StatusBadge status={b.status} />
      </View>

      {b.status === 'cancelled' ? (
        <Card>
          <Notice text={t.status.cancelled.detail} tone="grey" />
          {b.cancelReason ? (
            <AppText color={colors.textMuted}>{t.detail.cancelReason(b.cancelReason)}</AppText>
          ) : null}
        </Card>
      ) : (
        <Card>
          <StatusTracker status={b.status} />
        </Card>
      )}

      {b.assignedDriver && b.status === 'assigned' ? (
        <Card tone="cream">
          <AppText variant="small" weight="heavy" color={colors.amberText}>
            {t.detail.yourDriver.toUpperCase()}
          </AppText>
          <AppText variant="heading" weight="heavy">
            {b.assignedDriver.name}
          </AppText>
          <AppText color={colors.textMuted}>{prettyPhone(b.assignedDriver.phone)}</AppText>
          <Button
            title={t.detail.callDriver}
            icon="call"
            variant="dark"
            onPress={() => void callNumber(b.assignedDriver?.phone ?? '')}
          />
        </Card>
      ) : null}

      <Card>
        <InfoRow icon="time-outline" label={t.detail.when} value={formatPreferred(t, b.preferredTime)} />
        <InfoRow icon="location-outline" label={t.detail.pickup} value={b.pickup} />
        <InfoRow
          icon="business-outline"
          label={t.detail.city}
          value={t.cities[b.city as keyof typeof t.cities] ?? b.city}
        />
        {b.trip ? (
          <InfoRow
            icon="map-outline"
            label={t.detail.trip}
            value={tripSummary(t, b.trip, b.city, config.destinations)}
          />
        ) : null}
        {b.quote ? (
          <InfoRow
            icon="cash-outline"
            label={t.detail.price}
            value={`${rupees(b.quote.amount)} (${quoteBreakdown(t, b.quote)})`}
          />
        ) : null}
        {b.notes ? <InfoRow icon="document-text-outline" label={t.detail.notes} value={b.notes} /> : null}
        {b.createdAt ? (
          <InfoRow icon="calendar-outline" label={t.detail.bookedOn} value={formatDateTime(t, b.createdAt)} />
        ) : null}
      </Card>

      {b.status === 'completed' && config.google.writeReview ? (
        <Card tone="cream">
          <AppText weight="heavy">{t.detail.reviewTitle}</AppText>
          <AppText variant="small" color={colors.textMuted}>
            {t.detail.reviewBody}
          </AppText>
          <Button
            title={t.detail.reviewButton}
            icon="star"
            variant="outline"
            onPress={() => void openWebPage(config.google.writeReview)}
          />
        </Card>
      ) : null}

      <View style={styles.help}>
        <AppText weight="bold">{t.detail.help}</AppText>
        <ContactActions message={t.detail.helpMessage(ref)} />
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  help: { gap: space.sm },
}));

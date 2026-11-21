import { type Booking, rupees } from '@drivebuddy/shared';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Notice } from '@/components/bits';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { acceptPrice } from '@/data/selfserve';
import { useI18n } from '@/i18n';
import { makeStyles, space, useTheme } from '@/theme';

/**
 * "Accept price ₹X" on a trip estimate (spec item 2). The screen shows it only
 * when canAcceptPrice; the live booking then comes back with acceptedPrice
 * (straight away, from the phone's own copy) and WaitingCard takes over.
 */
export function AcceptPriceCard({ booking }: { booking: Booking }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const amount = booking.trip?.estTo ?? 0;

  async function accept() {
    setBusy(true);
    setFailed(false);
    const res = await acceptPrice(booking.id, amount);
    setBusy(false);
    if (!res.ok) setFailed(true);
  }

  return (
    <Card tone="cream">
      <AppText weight="heavy">{t.detail.accept.title}</AppText>
      <AppText variant="small" color={colors.textMuted}>
        {t.detail.accept.body}
      </AppText>
      {failed ? <Notice text={t.detail.accept.error} tone="danger" /> : null}
      <Button
        testID="accept-price"
        title={t.detail.accept.button(rupees(amount))}
        icon="checkmark-circle"
        loading={busy}
        onPress={() => void accept()}
      />
    </Card>
  );
}

/**
 * Between "confirmed" and "driver assigned": the price the customer accepted,
 * or simply that drivers near them have the job (spec items 1, 2, 12).
 */
export function WaitingCard({ accepted }: { accepted: boolean }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Card tone="cream">
      <View style={styles.row} accessibilityLiveRegion="polite">
        {accepted ? (
          <Ionicons name="checkmark-circle" size={22} color={colors.success} />
        ) : (
          <ActivityIndicator color={colors.amber} />
        )}
        <AppText weight="heavy" style={styles.flex}>
          {accepted ? t.detail.accept.done : t.detail.finding.title}
        </AppText>
      </View>
      <AppText variant="small" color={colors.textMuted}>
        {t.detail.finding.body}
      </AppText>
    </Card>
  );
}

const useStyles = makeStyles(() => ({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
}));

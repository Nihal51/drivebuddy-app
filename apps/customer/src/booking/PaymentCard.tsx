import { type Payment, payUrl, rupees } from '@drivebuddy/shared';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Notice } from '@/components/bits';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useI18n } from '@/i18n';
import { formatDateTime } from '@/i18n/format';
import { openUrl } from '@/lib/links';
import { makeStyles, space, useTheme } from '@/theme';

/**
 * The robot's Razorpay link for the bill (spec item 6): "Pay ₹X" while it is
 * pending, "Paid ✓" once Razorpay says so. Only a checked Razorpay address
 * opens (payUrl); anything else falls back to the SMS Razorpay sends.
 */
export function PaymentCard({ payment }: { payment: Payment }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useStyles();
  const [openFailed, setOpenFailed] = useState(false);
  const url = payUrl(payment);
  const amount = rupees(payment.amount);

  if (payment.status === 'paid') {
    return (
      <Card>
        <View style={styles.row}>
          <Ionicons name="checkmark-circle" size={24} color={colors.success} />
          <AppText weight="heavy" color={colors.success} style={styles.flex}>
            {t.detail.pay.paid(amount)}
          </AppText>
        </View>
        {payment.paidAt ? (
          <AppText variant="small" color={colors.textMuted}>
            {t.detail.pay.paidOn(formatDateTime(t, payment.paidAt))}
          </AppText>
        ) : null}
      </Card>
    );
  }

  async function pay() {
    if (!url) return;
    setOpenFailed(!(await openUrl(url)));
  }

  return (
    <Card tone="cream">
      <AppText variant="small" weight="heavy" color={colors.amberText}>
        {t.detail.pay.title.toUpperCase()}
      </AppText>
      <AppText variant="title" weight="heavy">
        {amount}
      </AppText>
      {url ? (
        <>
          <AppText variant="small" color={colors.textMuted}>
            {t.detail.pay.body}
          </AppText>
          {openFailed ? <Notice text={t.detail.pay.openFailed} tone="danger" /> : null}
          <Button testID="pay" title={t.detail.pay.button(amount)} icon="card" onPress={() => void pay()} />
        </>
      ) : (
        <Notice text={t.detail.pay.bySms} />
      )}
    </Card>
  );
}

const useStyles = makeStyles(() => ({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
}));

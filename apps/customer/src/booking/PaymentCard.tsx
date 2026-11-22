import { type Payment, rupees } from '@drivebuddy/shared';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { View } from 'react-native';

import { paymentView } from '@/booking/selfserve';
import { AppText } from '@/components/AppText';
import { Notice } from '@/components/bits';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useI18n } from '@/i18n';
import { formatDateTime } from '@/i18n/format';
import { openUrl } from '@/lib/links';
import { makeStyles, space, useTheme } from '@/theme';

/**
 * The robot's pay link for the bill (automation item 6, SPEC-upi item 8):
 * "Pay ₹X by UPI" (opens his UPI app on DriveBuddy's UPI ID) or "Pay ₹X"
 * (the Razorpay page) while it is pending; "Paid ✓", with how, once Razorpay
 * or the driver says so. Only a checked link opens (payUrl); otherwise the
 * customer pays the driver / uses the SMS Razorpay sends.
 *
 * Linking.canOpenURL is not asked first: on Android 11+ it answers false for
 * `upi:` unless the app lists the scheme in its manifest's <queries>, which
 * this app does not, so it would hide the button from everyone. openURL
 * itself fails when no app takes the link, and that is what is shown.
 */
export function PaymentCard({ payment }: { payment: Payment }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useStyles();
  const [openFailed, setOpenFailed] = useState(false);
  const view = paymentView(payment);
  const amount = rupees(payment.amount);

  if (view.kind === 'paid') {
    return (
      <Card>
        <View style={styles.row}>
          <Ionicons name="checkmark-circle" size={24} color={colors.success} />
          <AppText weight="heavy" color={colors.success} style={styles.flex}>
            {view.method === 'cash'
              ? t.detail.pay.paidCash(amount)
              : view.method === 'upi'
                ? t.detail.pay.paidUpi(amount)
                : t.detail.pay.paid(amount)}
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

  async function pay(url: string) {
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
      {view.kind === 'pay' ? (
        <>
          <AppText variant="small" color={colors.textMuted}>
            {view.upi ? t.detail.pay.bodyUpi : t.detail.pay.body}
          </AppText>
          {openFailed ? (
            <Notice text={view.upi ? t.detail.pay.noUpiApp : t.detail.pay.openFailed} tone="danger" />
          ) : null}
          <Button
            testID="pay"
            title={view.upi ? t.detail.pay.buttonUpi(amount) : t.detail.pay.button(amount)}
            icon={view.upi ? 'phone-portrait' : 'card'}
            onPress={() => void pay(view.url)}
          />
        </>
      ) : (
        <Notice text={view.kind === 'pay-driver' ? t.detail.pay.payDriver : t.detail.pay.bySms} />
      )}
    </Card>
  );
}

const useStyles = makeStyles(() => ({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
}));

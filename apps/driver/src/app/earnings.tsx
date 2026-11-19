/** My earnings: the jobs he took from offers — what DriveBuddy owes him and has paid. */

import { rupees } from '@drivebuddy/shared';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useDriverAuth } from '@/auth/DriverAuth';
import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { type Offer, earningsOf, watchMyOffers } from '@/data/offers';
import { useI18n } from '@/i18n';
import { formatDateTime, formatPreferred, packageName } from '@/i18n/format';
import { makeStyles, space, useTheme } from '@/theme';

export default function EarningsScreen() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useStyles();
  const { state } = useDriverAuth();
  const phone = state.status === 'in' ? state.driver.phone : '';
  const [offers, setOffers] = useState<Offer[] | null>(null);

  useEffect(() => (phone ? watchMyOffers(phone, (list) => setOffers(list ?? [])) : undefined), [phone]);

  if (offers === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.amber} />
      </View>
    );
  }
  const e = earningsOf(offers);

  return (
    <Screen edges={['bottom']}>
      <Card tone="cream">
        <AppText variant="small" color={colors.textMuted}>
          {t.earnings.owed}
        </AppText>
        <AppText variant="display" weight="heavy">
          {rupees(e.owed)}
        </AppText>
        <View style={styles.row}>
          <AppText variant="small" color={colors.textMuted}>
            {t.earnings.upcoming}: {rupees(e.upcoming)}
          </AppText>
          <AppText variant="small" color={colors.textMuted}>
            {t.earnings.paid}: {rupees(e.paid)}
          </AppText>
        </View>
        <AppText variant="tiny" color={colors.textFaint}>
          {t.earnings.note}
        </AppText>
      </Card>

      {e.list.length === 0 ? <AppText color={colors.textMuted}>{t.earnings.empty}</AppText> : null}

      {e.list.map((o) => (
        <Card key={o.id}>
          <View style={styles.row}>
            <AppText weight="bold" style={{ flex: 1 }}>
              {packageName(t, o.packageId)}
              {o.ref ? ` · ${o.ref}` : ''}
            </AppText>
            <AppText weight="heavy">{rupees(o.driverPay)}</AppText>
          </View>
          <AppText variant="small" color={colors.textMuted}>
            {formatPreferred(t, o.when)} · {o.area}
          </AppText>
          <AppText
            variant="small"
            weight="bold"
            color={o.paid ? colors.success : o.done ? colors.amberText : colors.textFaint}
          >
            {o.paid
              ? t.earnings.statusPaid(o.paidAt ? formatDateTime(t, o.paidAt) : '')
              : o.done
                ? t.earnings.statusOwed
                : t.earnings.statusUpcoming}
          </AppText>
        </Card>
      ))}
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, flexWrap: 'wrap' },
}));

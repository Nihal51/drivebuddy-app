/**
 * A job he took that DriveBuddy has not confirmed yet ("Waiting for
 * confirmation"), at the top of My jobs. Built from his offer only — what,
 * where (area, and the city when it is not his), when, and his pay — because
 * the customer's name, number and address are his only after the office's
 * call; then the job itself replaces this card. Until he taps Start he can
 * still give it back ("Can't make it").
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import { rupees } from '@drivebuddy/shared';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { type Offer, releaseJob } from '@/data/offers';
import { useI18n } from '@/i18n';
import { formatPreferred, packageName } from '@/i18n/format';
import { makeStyles, radius, space, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';

export function WaitingCard({
  offer,
  myCity,
  me,
}: {
  offer: Offer;
  myCity: string;
  me: { phone: string; uid: string };
}) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useStyles();
  const [busy, setBusy] = useState(false);

  const release = async () => {
    setBusy(true);
    // He cannot have tapped Start: trip taps need a confirmed job.
    const res = await releaseJob(offer.id, me, false);
    setBusy(false);
    Alert.alert(
      t.appName,
      res.ok
        ? t.job.released
        : res.reason === 'started'
          ? t.job.releaseStarted
          : res.reason === 'not-from-offer'
            ? t.job.gone
            : t.job.releaseFailed,
    );
  };

  const confirmRelease = () =>
    Alert.alert(t.job.cantMakeTitle, t.job.cantMakeBody, [
      { text: t.job.cantMakeKeep, style: 'cancel' },
      { text: t.job.cantMakeConfirm, style: 'destructive', onPress: () => void release() },
    ]);

  return (
    <View style={styles.card} testID={`waiting-${offer.id}`}>
      <View style={styles.row}>
        <Ionicons name="hourglass-outline" size={16} color={colors.amberText} />
        <AppText variant="small" weight="heavy" color={colors.amberText}>
          {t.jobs.waitingTitle.toUpperCase()}
        </AppText>
      </View>
      <View style={styles.row}>
        <AppText weight="bold" variant="heading" style={{ flex: 1 }}>
          {packageName(t, offer.packageId)}
        </AppText>
        <AppText weight="heavy" color={colors.success}>
          {t.offers.youEarn(rupees(offer.driverPay))}
        </AppText>
      </View>
      <AppText color={colors.amberText} weight="bold">
        {formatPreferred(t, offer.when)}
      </AppText>
      <View style={styles.row}>
        <Ionicons name="location-outline" size={16} color={colors.textMuted} />
        <AppText color={colors.textMuted} style={{ flex: 1 }}>
          {offer.city && offer.city !== myCity ? `${offer.area} · ${offer.city}` : offer.area}
        </AppText>
      </View>
      {offer.to ? (
        <AppText variant="small" color={colors.textMuted}>
          {t.job.tripTo(offer.to)}
        </AppText>
      ) : null}
      <AppText variant="small">{t.jobs.waitingBody}</AppText>
      <Button
        title={t.job.cantMake}
        icon="close-circle-outline"
        variant="ghost"
        compact
        onPress={confirmRelease}
        loading={busy}
        testID={`waiting-release-${offer.id}`}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  card: {
    backgroundColor: c.cream,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.xs,
    borderWidth: 1,
    borderColor: c.creamLine,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
}));

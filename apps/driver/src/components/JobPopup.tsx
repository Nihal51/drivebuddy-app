/**
 * The full-screen "New job" popup: what, where, when, and big "You earn ₹X"
 * (his pay only — never the customer's price or DriveBuddy's cut), Accept,
 * Not now, and a 30-second countdown after which it closes by itself.
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import { rupees } from '@drivebuddy/shared';
import { useEffect, useRef, useState } from 'react';
import { Modal, View } from 'react-native';

import type { Offer } from '@/data/offers';
import { secondsLeft } from '@/data/popup';
import { useI18n } from '@/i18n';
import { formatPreferred, packageName } from '@/i18n/format';
import { makeStyles, radius, space, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';

export function JobPopup({
  offer,
  raised,
  myCity,
  openedAt,
  busy,
  onAccept,
  onDismiss,
  onTimeout,
}: {
  offer: Offer;
  raised: boolean;
  myCity: string;
  /** When it opened (ms): the countdown runs from here. */
  openedAt: number;
  /** Accepting: the buttons wait and the countdown no longer closes it. */
  busy: boolean;
  onAccept: () => void;
  onDismiss: () => void;
  onTimeout: () => void;
}) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useStyles();
  const [now, setNow] = useState(() => Date.now());
  const left = secondsLeft(openedAt, now);
  const timedOut = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (left > 0 || busy || timedOut.current) return;
    timedOut.current = true;
    onTimeout();
  }, [left, busy, onTimeout]);

  return (
    <Modal visible animationType="slide" onRequestClose={busy ? () => {} : onDismiss} statusBarTranslucent>
      <View style={styles.page} testID="job-popup">
        <View style={styles.top}>
          <AppText variant="small" weight="heavy" color={raised ? colors.success : colors.amberText}>
            {(raised ? t.offers.popupRaised : t.offers.popupNew).toUpperCase()}
          </AppText>
          <AppText variant="small" weight="bold" color={colors.textMuted} testID="popup-countdown">
            {t.offers.closesIn(left)}
          </AppText>
        </View>

        <View style={styles.body}>
          <AppText variant="title" weight="heavy">
            {packageName(t, offer.packageId)}
          </AppText>
          <View style={styles.row}>
            <Ionicons name="location-outline" size={20} color={colors.textMuted} />
            <AppText variant="heading" color={colors.textMuted} style={{ flex: 1 }}>
              {/* A job from a neighbouring city (nobody there took it): say which. */}
              {offer.city && offer.city !== myCity ? `${offer.area} · ${offer.city}` : offer.area}
            </AppText>
          </View>
          {offer.to ? <AppText color={colors.textMuted}>{t.job.tripTo(offer.to)}</AppText> : null}
          <View style={styles.row}>
            <Ionicons name="time-outline" size={20} color={colors.amberText} />
            <AppText variant="heading" weight="bold" color={colors.amberText}>
              {formatPreferred(t, offer.when)}
            </AppText>
          </View>
          <View style={styles.pay}>
            <AppText variant="display" weight="heavy" color={colors.success} testID="popup-pay">
              {t.offers.youEarn(rupees(offer.driverPay))}
            </AppText>
          </View>
        </View>

        <View style={styles.buttons}>
          <Button
            title={t.offers.accept}
            icon="checkmark-circle"
            onPress={onAccept}
            loading={busy}
            testID="popup-accept"
          />
          <Button
            title={t.offers.notNow}
            variant="ghost"
            onPress={onDismiss}
            disabled={busy}
            testID="popup-not-now"
          />
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  page: {
    flex: 1,
    backgroundColor: c.background,
    padding: space.lg,
    paddingTop: space.xl * 2,
    gap: space.lg,
    justifyContent: 'space-between',
  },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  body: { gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  pay: {
    marginTop: space.md,
    backgroundColor: c.successSoft,
    borderRadius: radius.lg,
    padding: space.lg,
    alignItems: 'center',
  },
  buttons: { gap: space.sm, paddingBottom: space.lg },
}));

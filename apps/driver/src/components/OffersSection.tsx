/**
 * "New job offers" on the home screen: Online / Offline and the Job alerts
 * card, open offers for his city (and nearby ones nobody took), with what he
 * earns and Accept — and, while he is Online, the "New job" popup for each
 * new one (JobPopupHost).
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import { rupees } from '@drivebuddy/shared';
import { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';

import type { Driver } from '@/auth/DriverAuth';
import { type MyRecord, readMyRecord } from '@/data/me';
import { type Offer, acceptOffer, watchOpenOffers } from '@/data/offers';
import { useI18n } from '@/i18n';
import { formatPreferred, packageName } from '@/i18n/format';
import { makeStyles, radius, space, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';
import { JobAlertsCard } from './JobAlertsCard';
import { JobPopupHost } from './JobPopupHost';
import { OnlineCard } from './OnlineCard';

export function OffersSection({ driver }: { driver: Driver }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useStyles();
  const [me, setMe] = useState<MyRecord | null | undefined>(undefined);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [online, setOnline] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void readMyRecord(driver.driverId).then((r) => alive && setMe(r));
    return () => {
      alive = false;
    };
  }, [driver.driverId]);

  const active = me?.status === 'active' && Boolean(me.city);
  useEffect(() => {
    if (!active || !me) return;
    return watchOpenOffers(me.city, (list, complete) => {
      setOffers(list ?? []);
      setLoaded(complete);
    });
  }, [active, me]);

  /** Accept: the offer and the booking change together (or not at all) → the words for the result. */
  const take = useCallback(
    async (o: Offer): Promise<string> => {
      setBusy(o.id);
      const res = await acceptOffer(o.id, {
        driverId: driver.driverId,
        name: me?.name ?? driver.name,
        uid: driver.uid,
      });
      setBusy(null);
      return res.ok ? t.offers.accepted : res.reason === 'gone' ? t.offers.gone : t.offers.failed;
    },
    [driver, me, t],
  );

  if (me === undefined) return null; // loading
  const popups = (
    <JobPopupHost
      offers={offers}
      loaded={loaded}
      watching={active}
      canPop={active && online}
      myCity={me?.city ?? ''}
      onTake={take}
    />
  );
  if (!active && me === null) return popups; // the review login
  if (!active) {
    return (
      <>
        <AppText variant="small" color={colors.textMuted}>
          {t.offers.notActive}
        </AppText>
        {popups}
      </>
    );
  }
  const meNow = me as MyRecord;

  const accept = (o: Offer) =>
    Alert.alert(t.offers.acceptTitle, t.offers.acceptBody(rupees(o.driverPay)), [
      { text: t.jobs.cancel, style: 'cancel' },
      {
        text: t.offers.accept,
        onPress: () => void take(o).then((words) => Alert.alert(t.appName, words)),
      },
    ]);

  return (
    <View style={styles.wrap}>
      <OnlineCard driver={driver} me={meNow} onOnline={setOnline} />
      <JobAlertsCard driver={driver} me={meNow} online={online} />
      {popups}
      {offers.length ? (
        <AppText variant="heading" weight="heavy">
          {t.offers.title} ({offers.length})
        </AppText>
      ) : null}
      {offers.map((o) => (
        <View key={o.id} style={styles.card} testID={`offer-${o.id}`}>
          <View style={styles.top}>
            <AppText weight="bold" variant="heading" style={{ flex: 1 }}>
              {packageName(t, o.packageId)}
            </AppText>
            <AppText weight="heavy" color={colors.success}>
              {t.offers.youEarn(rupees(o.driverPay))}
            </AppText>
          </View>
          <AppText color={colors.amberText} weight="bold">
            {formatPreferred(t, o.when)}
          </AppText>
          <View style={styles.row}>
            <Ionicons name="location-outline" size={16} color={colors.textMuted} />
            <AppText color={colors.textMuted} style={{ flex: 1 }}>
              {/* A job from a neighbouring city (nobody there took it): say which. */}
              {o.city && o.city !== meNow.city ? `${o.area} · ${o.city}` : o.area}
            </AppText>
          </View>
          {o.to ? (
            <AppText variant="small" color={colors.textMuted}>
              {t.job.tripTo(o.to)}
            </AppText>
          ) : null}
          <Button
            title={t.offers.accept}
            icon="checkmark-circle"
            compact
            loading={busy === o.id}
            onPress={() => accept(o)}
            testID={`accept-${o.id}`}
          />
        </View>
      ))}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { gap: space.md },
  card: {
    backgroundColor: c.cream,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.xs,
    borderWidth: 1,
    borderColor: c.creamLine,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
}));

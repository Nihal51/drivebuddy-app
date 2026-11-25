/** Online / Offline for job alerts, at the top of the home screen (Active drivers only). */

import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';

import type { Driver } from '@/auth/DriverAuth';
import { rememberPhoneToken } from '@/data/alerts';
import type { MyRecord } from '@/data/me';
import { useI18n } from '@/i18n';
import { jobAlertsToken } from '@/notifications/push';
import { type Online, goOffline, goOnline, onOnlineChange, tidyOnline } from '@/tracking/sharing';
import { makeStyles, radius, space, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';

export function OnlineCard({
  driver,
  me,
  onOnline,
}: {
  driver: Driver;
  me: MyRecord;
  /** Told whenever he goes Online / Offline (the job popup shows only while Online). */
  onOnline?: (on: boolean) => void;
}) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useStyles();
  const [online, setOnline] = useState<Online | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void tidyOnline().then((o) => alive && setOnline(o));
    const off = onOnlineChange((o) => alive && setOnline(o));
    return () => {
      alive = false;
      off();
    };
  }, []);

  useEffect(() => {
    if (online !== undefined) onOnline?.(Boolean(online));
  }, [online, onOnline]);

  if (online === undefined) return null;
  const isOn = Boolean(online);

  const toggle = async () => {
    setBusy(true);
    setNote(null);
    if (isOn) {
      await goOffline();
    } else {
      // Going online signs this phone up for alerts again (goOnline saves the token).
      const token = await jobAlertsToken(t.online.channel);
      rememberPhoneToken(token);
      const res = await goOnline(
        { driverId: driver.driverId, city: me.city, name: me.name, phone: driver.phone },
        token,
        {
          online: { title: t.online.serviceTitle, body: t.online.serviceBody },
          sharing: { title: t.job.notificationTitle, body: t.job.notificationBody },
        },
      );
      if (!res.ok)
        setNote(
          res.reason === 'permission'
            ? t.online.permission
            : res.reason === 'gps-off'
              ? t.online.gpsOff
              : t.online.failed,
        );
      else if (!res.alerts) setNote(t.online.noAlerts);
    }
    setBusy(false);
  };

  return (
    <View style={[styles.card, isOn ? styles.on : styles.off]} testID="online-card">
      <View style={styles.row}>
        <View style={[styles.dot, { backgroundColor: isOn ? colors.success : colors.textFaint }]} />
        <AppText variant="heading" weight="heavy" style={{ flex: 1 }}>
          {isOn ? t.online.onTitle : t.online.offTitle}
        </AppText>
        <Ionicons
          name={isOn ? 'radio' : 'radio-outline'}
          size={22}
          color={isOn ? colors.success : colors.textFaint}
        />
      </View>
      <AppText variant="small" color={colors.textMuted}>
        {isOn ? t.online.onBody : t.online.offBody}
      </AppText>
      {note ? (
        <AppText variant="small" color={colors.amberText}>
          {note}
        </AppText>
      ) : null}
      {note === t.online.permission ? (
        <Button
          title={t.job.openSettings}
          variant="outline"
          compact
          onPress={() => void Linking.openSettings()}
        />
      ) : null}
      <Button
        title={isOn ? t.online.goOffline : t.online.goOnline}
        variant={isOn ? 'outline' : 'primary'}
        icon={isOn ? 'pause-circle' : 'flash'}
        loading={busy}
        onPress={() => void toggle()}
        testID="online-toggle"
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  card: { borderRadius: radius.lg, padding: space.lg, gap: space.sm, borderWidth: 1.5 },
  on: { backgroundColor: c.successSoft, borderColor: c.success },
  off: { backgroundColor: c.surface, borderColor: c.line },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 12, height: 12, borderRadius: 6 },
}));

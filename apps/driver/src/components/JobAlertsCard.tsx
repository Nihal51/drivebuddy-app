/**
 * "Job alerts" on the home screen (Active drivers): whether a new job can
 * reach this phone with the app closed — notifications allowed, signed up
 * (push token saved), online, what became of the last alert — with "Send me
 * a test alert", and on Android the battery setting that stops alerts on
 * many phones. data/alerts.ts has the why.
 *
 * It also signs the phone up again at every app start: a token can change
 * (a reinstall, Android renewing it, the robot dropping one Expo said is
 * dead), and an old one fails silently.
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import type { AlertTest } from '@drivebuddy/shared';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Platform, View } from 'react-native';

import type { Driver } from '@/auth/DriverAuth';
import {
  type Availability,
  alertsWork,
  askTestAlert,
  canAskTest,
  markTokenSaved,
  newest,
  phoneToken,
  rememberPhoneToken,
  signedUpHere,
  testView,
  tokenSavedThisRun,
  watchAlertTest,
  watchAvailability,
} from '@/data/alerts';
import { type MyRecord, watchMyRecord } from '@/data/me';
import { useI18n } from '@/i18n';
import { lastAlertText, testText } from '@/i18n/format';
import { type AlertPermission, alertPermission, jobAlertsToken } from '@/notifications/push';
import { savePushToken } from '@/tracking/sharing';
import { makeStyles, radius, space, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Button, type IconName } from './Button';

export function JobAlertsCard({
  driver,
  me,
  online,
}: {
  driver: Driver;
  me: Pick<MyRecord, 'city' | 'name'>;
  online: boolean;
}) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useStyles();
  const { driverId, phone } = driver;
  const [permission, setPermission] = useState<AlertPermission | null>(null);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [record, setRecord] = useState<MyRecord | null>(null);
  const [test, setTest] = useState<AlertTest | null>(null);
  const [busy, setBusy] = useState<'allow' | 'test' | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  /** Get this phone's token and save it where the robot looks; `ask` shows the phone's question first. */
  const signUp = useCallback(
    async (ask: boolean) => {
      const token = await jobAlertsToken(t.online.channel, ask);
      setPermission(await alertPermission());
      if (!token) return;
      rememberPhoneToken(token);
      if (await savePushToken({ driverId, city: me.city, name: me.name, phone }, token))
        markTokenSaved(driverId);
    },
    [driverId, me.city, me.name, phone, t.online.channel],
  );

  // At start, and each time he comes back to the app (from the phone's settings, say).
  useEffect(() => {
    const check = () => {
      if (!tokenSavedThisRun(driverId)) void signUp(false);
      else void alertPermission().then(setPermission);
    };
    check();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && check());
    return () => sub.remove();
  }, [driverId, signUp]);

  useEffect(() => watchAvailability(driverId, setAvailability), [driverId]);
  useEffect(() => watchMyRecord(driverId, setRecord), [driverId]);
  useEffect(() => watchAlertTest(driverId, setTest), [driverId]);

  // While a test cannot be asked for yet, look again every few seconds.
  const mayTest = canAskTest(test, now);
  useEffect(() => {
    if (mayTest) return;
    const timer = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(timer);
  }, [mayTest]);

  const allow = async () => {
    if (permission === 'blocked') {
      void Linking.openSettings();
      return;
    }
    setBusy('allow');
    await signUp(true);
    setBusy(null);
  };

  const sendTest = async () => {
    setBusy('test');
    setNote(null);
    const res = await askTestAlert(driverId);
    setNow(Date.now());
    setBusy(null);
    if (!res.ok) setNote(res.reason === 'too-soon' ? t.alerts.testTooSoon : t.alerts.testAskFailed);
  };

  const signedUp = signedUpHere(availability?.pushToken ?? '', phoneToken());
  const view = testView(test);
  const last = record?.lastAlert;
  const works =
    permission !== null &&
    alertsWork({ permission, signedUp, last: newest(last, view.kind === 'done' ? view.result : undefined) });
  const testLine = testText(t, view, now);

  return (
    <View style={styles.card} testID="job-alerts">
      <View style={styles.row}>
        <Ionicons name="notifications" size={20} color={colors.amberText} />
        <AppText variant="heading" weight="heavy" style={styles.flex}>
          {t.alerts.title}
        </AppText>
        {permission !== null ? (
          <View style={[styles.pill, { backgroundColor: works ? colors.successSoft : colors.dangerSoft }]}>
            <AppText variant="small" weight="bold" color={works ? colors.success : colors.danger}>
              {works ? t.alerts.working : t.alerts.attention}
            </AppText>
          </View>
        ) : null}
      </View>

      {permission !== null ? (
        <Line
          state={permission === 'granted' ? 'ok' : 'bad'}
          text={permission === 'granted' ? t.alerts.permissionOn : t.alerts.permissionOff}
          testID="alerts-permission"
        />
      ) : null}
      {permission === 'ask' || permission === 'blocked' ? (
        <Button
          title={permission === 'blocked' ? t.alerts.openSettings : t.alerts.allow}
          icon="notifications-outline"
          compact
          loading={busy === 'allow'}
          onPress={() => void allow()}
          testID="alerts-allow"
        />
      ) : null}

      <Line
        state={signedUp ? 'ok' : 'bad'}
        text={signedUp ? t.alerts.signedUp : t.alerts.notSignedUp}
        testID="alerts-token"
      />
      {permission === 'granted' && !signedUp ? (
        <Button
          title={t.alerts.signUp}
          icon="refresh"
          variant="outline"
          compact
          loading={busy === 'allow'}
          onPress={() => void allow()}
          testID="alerts-signup"
        />
      ) : null}

      <Line
        state={online ? 'ok' : 'off'}
        text={online ? t.alerts.onlineOn : t.alerts.onlineOff}
        testID="alerts-online"
      />
      <Line
        state={!last ? 'off' : last.ok ? 'ok' : 'bad'}
        text={lastAlertText(t, last, now)}
        testID="alerts-last"
      />

      {testLine ? (
        <AppText
          variant="small"
          weight="bold"
          color={view.kind === 'done' && !view.result.ok ? colors.danger : colors.textMuted}
          testID="alerts-test-result"
          accessibilityLiveRegion="polite"
        >
          {testLine}
        </AppText>
      ) : null}
      {note ? (
        <AppText variant="small" color={colors.amberText}>
          {note}
        </AppText>
      ) : null}
      <Button
        title={t.alerts.test}
        icon="paper-plane-outline"
        variant="outline"
        compact
        loading={busy === 'test'}
        disabled={!mayTest}
        onPress={() => void sendTest()}
        testID="alerts-test"
      />

      {Platform.OS === 'android' ? (
        <View style={styles.battery}>
          <AppText variant="small" weight="bold">
            {t.alerts.batteryTitle}
          </AppText>
          <AppText variant="small" color={colors.textMuted}>
            {t.alerts.batteryBody}
          </AppText>
          <Button
            title={t.alerts.batteryButton}
            icon="battery-charging-outline"
            variant="ghost"
            compact
            onPress={() => void Linking.openSettings()}
            testID="alerts-battery"
          />
        </View>
      ) : null}
    </View>
  );
}

const LINE_ICON: Record<'ok' | 'bad' | 'off', IconName> = {
  ok: 'checkmark-circle',
  bad: 'alert-circle',
  off: 'ellipse-outline',
};

/** One check: a tick, a warning, or a plain circle (not a fault), and what it means. */
function Line({ state, text, testID }: { state: 'ok' | 'bad' | 'off'; text: string; testID: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const color = state === 'ok' ? colors.success : state === 'bad' ? colors.danger : colors.textFaint;
  return (
    <View style={styles.line} testID={testID}>
      <Ionicons name={LINE_ICON[state]} size={18} color={color} style={styles.lineIcon} />
      <AppText variant="small" style={styles.flex}>
        {text}
      </AppText>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  card: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
  pill: { borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 2 },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  lineIcon: { marginTop: 1 },
  battery: {
    gap: space.xs,
    marginTop: space.xs,
    paddingTop: space.sm,
    borderTopWidth: 1,
    borderTopColor: c.line,
  },
}));

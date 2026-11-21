/**
 * One job: the customer, the pickup with Navigate, and his trip taps — Start
 * (on my way, live location on), Arrived (location off), Job done and, after
 * a one-way drop, Reached home. Before Start, a job he took from an offer can
 * be given back ("Can't make it").
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import { prettyPhone, telUrl } from '@drivebuddy/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, View } from 'react-native';

import { useDriverAuth } from '@/auth/DriverAuth';
import { AppText } from '@/components/AppText';
import { Button, type IconName } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { type Job, navigateUrl, watchJob } from '@/data/jobs';
import { type Offer, releaseCheck, releaseJob, watchOffer } from '@/data/offers';
import {
  type TapResult,
  type TapStep,
  type TripTaps,
  jobButtons,
  tapTimes,
  tapTrip,
  watchTripTaps,
} from '@/data/tripTaps';
import { type Messages, useI18n } from '@/i18n';
import { formatDateTime, formatPreferred, formatTime, packageName } from '@/i18n/format';
import { startSharing, stopSharing } from '@/tracking/sharing';
import { useSharing } from '@/tracking/useSharing';
import { makeStyles, space, useTheme } from '@/theme';

/** How each tap button looks and what it says. */
const TAP_BUTTON: Record<
  TapStep,
  { title: (t: Messages) => string; hint: (t: Messages) => string; icon: IconName; dark: boolean }
> = {
  leftAt: { title: (t) => t.job.start, hint: (t) => t.job.startHint, icon: 'navigate', dark: false },
  arrivedAt: { title: (t) => t.job.arrived, hint: (t) => t.job.arrivedHint, icon: 'flag', dark: true },
  doneAt: { title: (t) => t.job.done, hint: (t) => t.job.doneHint, icon: 'checkmark-done', dark: false },
  homeAt: { title: (t) => t.job.home, hint: (t) => t.job.homeHint, icon: 'home', dark: true },
};

/** After a saved tap the next button appears in the same place: a moment's pause stops a double tap from pressing it too. */
const COOL_MS = 2500;

export default function JobScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useStyles();
  const { state } = useDriverAuth();
  const sharing = useSharing();
  const [job, setJob] = useState<Job | null | undefined>(undefined);
  // undefined = not loaded yet; a refused read keeps the last times seen (the job may just have completed).
  const [taps, setTaps] = useState<TripTaps | null | undefined>(undefined);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [busy, setBusy] = useState<'tap' | 'share' | 'release' | null>(null);
  const [cool, setCool] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const coolTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => (id ? watchJob(id, setJob) : undefined), [id]);
  useEffect(
    () =>
      id
        ? watchTripTaps(id, (next) => setTaps((prev) => (next === undefined ? (prev ?? null) : next)))
        : undefined,
    [id],
  );
  useEffect(() => (id ? watchOffer(id, setOffer) : undefined), [id]);
  useEffect(
    () => () => {
      if (coolTimer.current) clearTimeout(coolTimer.current);
    },
    [],
  );

  if (job === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.amber} />
      </View>
    );
  }
  if (job === null || state.status !== 'in') {
    return (
      <Screen edges={[]}>
        <Card tone="cream">
          {/* A local job completes by itself on Job done, so it leaves his list straight away. */}
          <AppText>{taps?.doneAt ? t.job.finished : t.job.gone}</AppText>
        </Card>
        <Button title={t.job.back} variant="outline" onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  const { driver } = state;
  const sharingThis = sharing?.bookingId === job.id;
  const buttons = jobButtons(taps ?? null, job.packageId, sharingThis);
  const times = tapTimes(taps ?? null, job.packageId);
  const canRelease = !sharingThis && releaseCheck(offer, job, Boolean(taps?.leftAt), driver.phone) === 'ok';

  const tapProblem = (res: TapResult) =>
    res.ok ? null : res.reason === 'network' || res.reason === 'failed' ? t.job.tapFailed : t.job.tapRefused;

  const saved = () => {
    setCool(true);
    if (coolTimer.current) clearTimeout(coolTimer.current);
    coolTimer.current = setTimeout(() => setCool(false), COOL_MS);
  };

  const share = async () => {
    const res = await startSharing(job, driver, {
      title: t.job.notificationTitle,
      body: t.job.notificationBody,
    });
    if (!res.ok) {
      setProblem(
        res.reason === 'permission'
          ? t.job.permissionDenied
          : res.reason === 'gps-off'
            ? t.job.gpsOff
            : res.reason === 'other-job'
              ? t.job.otherJobSharing
              : t.job.startFailed,
      );
    }
  };

  const tap = async (step: TapStep) => {
    setBusy('tap');
    setProblem(null);
    const res = await tapTrip(job.id, step, job.packageId, driver.phone);
    const offline = !res.ok && (res.reason === 'network' || res.reason === 'failed');
    if (res.ok) saved();
    else setProblem(tapProblem(res));
    if (step === 'leftAt' && !offline) {
      // Also when the tap was refused (trip taps not switched on for him yet):
      // the customer still gets his live location, as before.
      await share();
    }
    if ((step === 'arrivedAt' || step === 'doneAt') && !offline && sharingThis) await stopSharing();
    setBusy(null);
  };

  const confirmTap = (step: 'doneAt' | 'homeAt') => {
    const words =
      step === 'doneAt'
        ? { title: t.job.doneTitle, body: t.job.doneBody, yes: t.job.doneConfirm }
        : { title: t.job.homeTitle, body: t.job.homeBody, yes: t.job.homeConfirm };
    Alert.alert(words.title, words.body, [
      { text: t.jobs.cancel, style: 'cancel' },
      { text: words.yes, onPress: () => void tap(step) },
    ]);
  };

  const onTap = (step: TapStep) =>
    step === 'doneAt' || step === 'homeAt' ? confirmTap(step) : void tap(step);

  const shareAgain = async () => {
    setBusy('share');
    setProblem(null);
    await share();
    setBusy(null);
  };

  const stopNow = async () => {
    setBusy('share');
    await stopSharing();
    setBusy(null);
  };

  const release = async () => {
    setBusy('release');
    setProblem(null);
    const res = await releaseJob(job.id, { phone: driver.phone, uid: driver.uid }, Boolean(taps?.leftAt));
    setBusy(null);
    if (res.ok) {
      Alert.alert(t.appName, t.job.released);
      router.replace('/');
      return;
    }
    setProblem(
      res.reason === 'started'
        ? t.job.releaseStarted
        : res.reason === 'not-his' || res.reason === 'not-from-offer'
          ? t.job.gone
          : t.job.releaseFailed,
    );
  };

  const confirmRelease = () =>
    Alert.alert(t.job.cantMakeTitle, t.job.cantMakeBody, [
      { text: t.job.cantMakeKeep, style: 'cancel' },
      { text: t.job.cantMakeConfirm, style: 'destructive', onPress: () => void release() },
    ]);

  const next = buttons.tap ? TAP_BUTTON[buttons.tap] : null;
  const footer =
    buttons.tap || buttons.shareAgain || buttons.stopSharing || canRelease ? (
      <View style={styles.footer}>
        {buttons.tap && next ? (
          <Button
            title={next.title(t)}
            icon={next.icon}
            variant={next.dark ? 'dark' : 'primary'}
            onPress={() => onTap(buttons.tap as TapStep)}
            loading={busy === 'tap'}
            // Until his saved taps have loaded, the right button is not known yet.
            disabled={taps === undefined || cool || (busy !== null && busy !== 'tap')}
            testID={`tap-${buttons.tap}`}
          />
        ) : null}
        {buttons.shareAgain ? (
          <Button
            title={t.job.shareAgain}
            icon="radio"
            variant="outline"
            compact
            onPress={() => void shareAgain()}
            loading={busy === 'share'}
            disabled={busy !== null && busy !== 'share'}
            testID="share-again"
          />
        ) : null}
        {buttons.stopSharing ? (
          <Button
            title={t.job.stopSharing}
            icon="stop-circle-outline"
            variant="outline"
            compact
            onPress={() => void stopNow()}
            loading={busy === 'share'}
            disabled={busy !== null && busy !== 'share'}
            testID="stop-sharing"
          />
        ) : null}
        {canRelease ? (
          <Button
            title={t.job.cantMake}
            icon="close-circle-outline"
            variant="ghost"
            compact
            onPress={confirmRelease}
            loading={busy === 'release'}
            disabled={busy !== null && busy !== 'release'}
            testID="cant-make-it"
          />
        ) : null}
      </View>
    ) : undefined;

  return (
    <Screen edges={['bottom']} footer={footer}>
      <View style={styles.head}>
        <AppText variant="title" weight="heavy">
          {packageName(t, job.packageId)}
        </AppText>
        <AppText color={colors.amberText} weight="bold">
          {formatPreferred(t, job.preferredTime)}
        </AppText>
        {job.ref ? (
          <AppText variant="small" color={colors.textFaint}>
            {job.ref}
          </AppText>
        ) : null}
      </View>

      {sharingThis ? (
        <Card tone="cream">
          <View style={styles.row}>
            <Ionicons name="radio" size={20} color={colors.success} />
            <AppText weight="bold" style={{ flex: 1 }}>
              {t.job.sharingNow}
            </AppText>
          </View>
          <AppText variant="small" color={colors.textMuted}>
            {t.job.sharingNote}
          </AppText>
          {sharing?.lastSentAt ? (
            <AppText variant="small" color={colors.textFaint}>
              {t.job.lastSent(formatTime(t, sharing.lastSentAt))}
            </AppText>
          ) : null}
        </Card>
      ) : null}

      {next ? (
        <AppText variant="small" color={colors.textMuted}>
          {next.hint(t)}
        </AppText>
      ) : null}

      {times.length ? (
        <Card>
          <AppText variant="small" color={colors.textFaint}>
            {t.job.tapsTitle}
          </AppText>
          {times.map(({ step, at }) => (
            <View key={step} style={styles.row}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <AppText style={{ flex: 1 }}>{t.job.taps[step]}</AppText>
              <AppText weight="bold">{formatDateTime(t, at)}</AppText>
            </View>
          ))}
          {buttons.tap === null ? (
            <AppText weight="bold" color={colors.success}>
              {t.job.allDone}
            </AppText>
          ) : null}
        </Card>
      ) : null}

      {problem ? (
        <Card tone="cream">
          <AppText>{problem}</AppText>
          {problem === t.job.permissionDenied ? (
            <Button
              title={t.job.openSettings}
              variant="outline"
              compact
              onPress={() => void Linking.openSettings()}
            />
          ) : null}
        </Card>
      ) : null}

      <Card>
        <AppText variant="small" color={colors.textFaint}>
          {t.job.customer}
        </AppText>
        <AppText variant="heading" weight="bold">
          {job.name}
        </AppText>
        <AppText color={colors.textMuted}>{prettyPhone(job.phone)}</AppText>
        <Button
          title={t.job.call}
          icon="call"
          variant="outline"
          compact
          onPress={() => void Linking.openURL(telUrl(job.phone))}
        />
      </Card>

      <Card>
        <AppText variant="small" color={colors.textFaint}>
          {t.job.pickup}
        </AppText>
        <AppText weight="bold">{job.pickup}</AppText>
        <AppText variant="small" color={colors.textMuted}>
          {job.city}
        </AppText>
        <Button
          title={t.job.navigate}
          icon="map"
          variant="dark"
          compact
          onPress={() => void Linking.openURL(navigateUrl(job))}
          testID="navigate"
        />
      </Card>

      {job.trip?.to ? (
        <Card>
          <AppText weight="bold">{t.job.tripTo(job.trip.to)}</AppText>
        </Card>
      ) : null}

      {job.notes.trim() ? (
        <Card>
          <AppText variant="small" color={colors.textFaint}>
            {t.job.notes}
          </AppText>
          <AppText>{job.notes}</AppText>
        </Card>
      ) : null}
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  head: { gap: space.xs, paddingTop: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  footer: { gap: space.sm },
}));

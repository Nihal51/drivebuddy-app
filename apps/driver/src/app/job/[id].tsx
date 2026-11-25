/**
 * One job: the customer, the pickup with Navigate, and his trip taps — Start
 * (on my way, live location on), Arrived (location off), Job done and, after
 * a one-way drop, Reached home. Before Start, a job he took from an offer can
 * be given back ("Can't make it"). After Job done: how the customer paid
 * (Paid by UPI / Paid in cash) — also once the robot has completed the job
 * and the booking can no longer be read, from the details already loaded.
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
import { type Job, confirmedForMe, navigateUrl, watchJob } from '@/data/jobs';
import { type Offer, releaseCheck, releaseJob, watchOffer } from '@/data/offers';
import {
  type PaidBy,
  type TapResult,
  type TapStep,
  type TripTaps,
  jobButtons,
  paymentCard,
  recordPayment,
  stayAfterDone,
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
  boardAt: { title: (t) => t.job.board, hint: (t) => t.job.boardHint, icon: 'train', dark: false },
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
  // The last details read: kept for the payment once the booking can no longer be read (completed).
  const [lastJob, setLastJob] = useState<Job | null>(null);
  // undefined = not loaded yet; a refused read keeps the last times seen (the job may just have completed).
  const [taps, setTaps] = useState<TripTaps | null | undefined>(undefined);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [busy, setBusy] = useState<'tap' | 'share' | 'release' | null>(null);
  const [cool, setCool] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const coolTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () =>
      id
        ? watchJob(id, (next) => {
            setJob(next);
            if (next) setLastJob(next);
          })
        : undefined,
    [id],
  );
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

  // A booking that cannot be read: wait for his taps before deciding between "paid?" and "no longer yours".
  if (job === undefined || (job === null && taps === undefined)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.amber} />
      </View>
    );
  }
  const afterDone = job === null && state.status === 'in' && stayAfterDone(taps, state.driver.phone);
  if (afterDone) {
    return <AfterDone id={id} job={lastJob} taps={taps ?? null} />;
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
  const canRelease = !sharingThis && releaseCheck(offer, Boolean(taps?.leftAt), driver) === 'ok';

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

  const confirmTap = (step: 'doneAt' | 'boardAt' | 'homeAt') => {
    const words =
      step === 'doneAt'
        ? { title: t.job.doneTitle, body: t.job.doneBody, yes: t.job.doneConfirm }
        : step === 'boardAt'
          ? { title: t.job.boardTitle, body: t.job.boardBody, yes: t.job.boardConfirm }
          : { title: t.job.homeTitle, body: t.job.homeBody, yes: t.job.homeConfirm };
    Alert.alert(words.title, words.body, [
      { text: t.jobs.cancel, style: 'cancel' },
      { text: words.yes, onPress: () => void tap(step) },
    ]);
  };

  const onTap = (step: TapStep) =>
    step === 'doneAt' || step === 'boardAt' || step === 'homeAt' ? confirmTap(step) : void tap(step);

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
    const res = await releaseJob(
      job.id,
      { driverId: driver.driverId, phone: driver.phone, uid: driver.uid },
      Boolean(taps?.leftAt),
    );
    setBusy(null);
    if (res.ok) {
      Alert.alert(t.appName, t.job.released);
      router.replace('/');
      return;
    }
    setProblem(
      res.reason === 'started'
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

  const next = buttons.tap ? TAP_BUTTON[buttons.tap] : null;
  const footer =
    buttons.tap || buttons.homeByBus || buttons.shareAgain || buttons.stopSharing || canRelease ? (
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
        {buttons.homeByBus ? (
          // Back by bus: no train to board, Reached home straight after the drop.
          <Button
            title={t.job.homeByBus}
            icon="bus"
            variant="outline"
            compact
            onPress={() => confirmTap('homeAt')}
            loading={busy === 'tap'}
            disabled={taps === undefined || cool || (busy !== null && busy !== 'tap')}
            testID="tap-homeAt-bus"
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
        {/* A job shows here only once DriveBuddy has called him and confirmed it. */}
        {taps?.doneAt || !confirmedForMe(job, driver.driverId) ? null : (
          <View style={styles.row}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <AppText weight="bold" color={colors.success} testID="driver-confirmed">
              {t.job.confirmed}
            </AppText>
          </View>
        )}
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

      <PaymentReceived id={job.id} taps={taps ?? null} />

      {job.packageId === 'one-way-drop' && taps?.doneAt && !taps.homeAt ? <TrainsHome job={job} /> : null}

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

/** Drops this far and farther get the train check at the drop (the first nearby tier, SPEC-v4). */
const TRAIN_CHECK_FROM_KM = 160;

/**
 * After a one-way drop (SPEC-v4 §2): the trains home the robot found — the
 * customer books his ticket — and once one is chosen, "Your train: 18452 at
 * 9:40 pm". No prices: those are the customer's.
 */
function TrainsHome({ job }: { job: Job }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const check = job.returnCheck;
  const choice = job.returnChoice;
  const at = (d?: Date) => (d ? formatDateTime(t, d) : '');
  if (choice) {
    return (
      <Card tone="cream">
        <AppText weight="heavy" testID="your-train">
          {t.job.yourTrain(choice.train, at(choice.dep))}
        </AppText>
      </Card>
    );
  }
  if (!check) {
    // The robot looks within a minute of the drop; nearer drops get no check.
    return (job.trip?.km ?? 0) > TRAIN_CHECK_FROM_KM ? (
      <Card>
        <AppText color={colors.textMuted}>{t.job.trainsLooking}</AppText>
      </Card>
    ) : null;
  }
  return (
    <Card>
      <AppText variant="small" weight="bold" color={colors.textFaint}>
        {t.job.trainsTitle}
      </AppText>
      {check.failed ? (
        <AppText>{t.job.trainsFailed}</AppText>
      ) : check.options.length === 0 ? (
        <AppText>{t.job.trainsBus}</AppText>
      ) : (
        check.options.slice(0, 3).map((o) => (
          <AppText key={`${o.train}-${o.dep?.getTime() ?? ''}`} testID={`train-${o.train}`}>
            {t.job.trainOption(o.train, o.name, o.from, at(o.dep))}
            {o.change ? t.job.trainChange(o.change.station, o.change.train) : ''}
          </AppText>
        ))
      )}
      {check.bus && check.options.length > 0 ? (
        <AppText variant="small" color={colors.textMuted}>
          {t.job.trainsLate}
        </AppText>
      ) : null}
    </Card>
  );
}

/**
 * The job after the robot completed it (he can no longer read the booking):
 * thanks, the payment card and his trip times, with the details he had.
 */
function AfterDone({ id, job, taps }: { id: string; job: Job | null; taps: TripTaps | null }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useStyles();
  const packageId = job?.packageId ?? null;
  const times = tapTimes(taps, packageId);
  return (
    <Screen edges={['bottom']}>
      {job ? (
        <View style={styles.head}>
          <AppText variant="title" weight="heavy">
            {packageName(t, job.packageId)}
          </AppText>
          {job.ref ? (
            <AppText variant="small" color={colors.textFaint}>
              {job.ref}
            </AppText>
          ) : null}
        </View>
      ) : null}
      <Card tone="cream">
        <AppText>{t.job.finished}</AppText>
      </Card>
      <PaymentReceived id={id} taps={taps} />
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
        </Card>
      ) : null}
      {job ? (
        <Card>
          <AppText variant="small" color={colors.textFaint}>
            {t.job.customer}
          </AppText>
          <AppText variant="heading" weight="bold">
            {job.name}
          </AppText>
          <Button
            title={t.job.call}
            icon="call"
            variant="outline"
            compact
            onPress={() => void Linking.openURL(telUrl(job.phone))}
          />
        </Card>
      ) : null}
    </Screen>
  );
}

/**
 * "Payment received" (SPEC-upi item 4), after Job done: collect ₹A, then
 * Paid by UPI / Paid in cash with a confirm; once saved, what he recorded and
 * the way back to My jobs. The answer is set once — no Change.
 */
function PaymentReceived({ id, taps }: { id: string; taps: TripTaps | null }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useStyles();
  const [busy, setBusy] = useState<PaidBy | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const card = paymentCard(taps);

  if (card.kind === 'none') return null;

  if (card.kind === 'recorded') {
    return (
      <Card>
        <View style={styles.row}>
          <Ionicons name="checkmark-circle" size={22} color={colors.success} />
          <AppText weight="heavy" color={colors.success} style={{ flex: 1 }}>
            {card.paidBy === 'upi' ? t.job.recordedUpi : t.job.recordedCash}
          </AppText>
        </View>
        <Button
          title={t.job.back}
          icon="list"
          variant="outline"
          compact
          onPress={() => router.replace('/')}
          testID="payment-back"
        />
      </Card>
    );
  }

  const save = async (paidBy: PaidBy) => {
    setBusy(paidBy);
    setProblem(null);
    const res = await recordPayment(id, paidBy);
    setBusy(null);
    // Saved: the live taps bring the "recorded" card by themselves.
    if (!res.ok)
      setProblem(res.reason === 'network' || res.reason === 'failed' ? t.job.tapFailed : t.job.tapRefused);
  };

  const confirm = (paidBy: PaidBy) => {
    const words =
      paidBy === 'upi'
        ? { title: t.job.upiTitle, body: t.job.upiBody, yes: t.job.upiConfirm }
        : { title: t.job.cashTitle, body: t.job.cashBody, yes: t.job.cashConfirm };
    Alert.alert(words.title, words.body, [
      { text: t.jobs.cancel, style: 'cancel' },
      { text: words.yes, onPress: () => void save(paidBy) },
    ]);
  };

  return (
    <Card tone="cream">
      <AppText variant="small" color={colors.textFaint}>
        {t.job.payTitle}
      </AppText>
      <AppText weight="bold" testID="pay-info">
        {t.job.payInfo}
      </AppText>
      <Button
        title={t.job.paidUpi}
        icon="phone-portrait"
        onPress={() => confirm('upi')}
        loading={busy === 'upi'}
        disabled={busy !== null}
        testID="paid-upi"
      />
      <Button
        title={t.job.paidCash}
        icon="cash"
        variant="dark"
        onPress={() => confirm('cash')}
        loading={busy === 'cash'}
        disabled={busy !== null}
        testID="paid-cash"
      />
      {problem ? <AppText color={colors.danger}>{problem}</AppText> : null}
    </Card>
  );
}

const useStyles = makeStyles(() => ({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  head: { gap: space.xs, paddingTop: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  footer: { gap: space.sm },
}));

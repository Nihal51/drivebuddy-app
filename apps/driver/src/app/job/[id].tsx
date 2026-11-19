/** One job: the customer, the pickup with Navigate, and Start / Arrived for live tracking. */

import Ionicons from '@expo/vector-icons/Ionicons';
import { prettyPhone, telUrl } from '@drivebuddy/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, View } from 'react-native';

import { useDriverAuth } from '@/auth/DriverAuth';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { type Job, navigateUrl, watchJob } from '@/data/jobs';
import { useI18n } from '@/i18n';
import { formatPreferred, formatTime, packageName } from '@/i18n/format';
import { startSharing, stopSharing } from '@/tracking/sharing';
import { useSharing } from '@/tracking/useSharing';
import { makeStyles, space, useTheme } from '@/theme';

export default function JobScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useStyles();
  const { state } = useDriverAuth();
  const sharing = useSharing();
  const [job, setJob] = useState<Job | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => (id ? watchJob(id, setJob) : undefined), [id]);

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
          <AppText>{t.job.gone}</AppText>
        </Card>
        <Button title={t.job.back} variant="outline" onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  const sharingThis = sharing?.bookingId === job.id;

  const start = async () => {
    setBusy(true);
    setProblem(null);
    const res = await startSharing(job, state.driver, {
      title: t.job.notificationTitle,
      body: t.job.notificationBody,
    });
    setBusy(false);
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

  const arrived = async () => {
    setBusy(true);
    await stopSharing();
    setBusy(false);
  };

  return (
    <Screen
      edges={['bottom']}
      footer={
        <View style={styles.footer}>
          {sharingThis ? (
            <Button
              title={t.job.arrived}
              icon="flag"
              variant="dark"
              onPress={arrived}
              loading={busy}
              testID="arrived"
            />
          ) : (
            <Button title={t.job.start} icon="navigate" onPress={start} loading={busy} testID="start" />
          )}
        </View>
      }
    >
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
      ) : (
        <AppText variant="small" color={colors.textMuted}>
          {t.job.startHint}
        </AppText>
      )}

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

/** My jobs: the bookings the office assigned to this driver, live. */

import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, View } from 'react-native';

import { useDriverAuth } from '@/auth/DriverAuth';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { LanguageToggle } from '@/components/LanguageToggle';
import { Screen } from '@/components/Screen';
import { type Job, watchJobs } from '@/data/jobs';
import { env } from '@/env';
import { useI18n } from '@/i18n';
import { formatPreferred, packageName } from '@/i18n/format';
import { stopSharing } from '@/tracking/sharing';
import { useSharing } from '@/tracking/useSharing';
import { makeStyles, radius, space, useTheme } from '@/theme';

export default function JobsScreen() {
  const { state } = useDriverAuth();
  const { colors } = useTheme();
  if (state.status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.amber} />
      </View>
    );
  }
  if (state.status === 'out') return <Redirect href="/login" />;
  return <Jobs phone={state.driver.phone} name={state.driver.name} />;
}

function Jobs({ phone, name }: { phone: string; name: string }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useStyles();
  const { logOut } = useDriverAuth();
  const sharing = useSharing();
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [round, setRound] = useState(0);

  useEffect(() => {
    return watchJobs(phone, (list) => {
      setFailed(!list);
      if (list) setJobs(list);
    });
  }, [phone, round]);

  // Sharing on a job that has left the list (completed or reassigned): stop it.
  useEffect(() => {
    if (jobs && sharing && !jobs.some((j) => j.id === sharing.bookingId)) {
      void stopSharing({ markEnded: false });
      Alert.alert(t.appName, t.jobs.stillSharing);
    }
  }, [jobs, sharing, t]);

  const confirmLogout = () =>
    Alert.alert(t.jobs.logout, t.jobs.logoutConfirm, [
      { text: t.jobs.cancel, style: 'cancel' },
      { text: t.jobs.logout, style: 'destructive', onPress: () => void logOut() },
    ]);

  return (
    <Screen edges={['top']} refreshing={false} onRefresh={() => setRound((r) => r + 1)}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <AppText variant="small" color={colors.textMuted}>
            {name ? t.jobs.hello(name.split(' ')[0] ?? name) : t.appName}
          </AppText>
          <AppText variant="display" weight="heavy">
            {t.jobs.title}
          </AppText>
        </View>
        <LanguageToggle size="small" />
      </View>

      {failed ? (
        <Card tone="cream">
          <AppText>{t.jobs.loadFailed}</AppText>
        </Card>
      ) : null}

      {jobs === null && !failed ? (
        <ActivityIndicator color={colors.amber} style={{ marginTop: space.xl }} />
      ) : null}

      {jobs && jobs.length === 0 ? (
        <Card>
          <Ionicons name="car-outline" size={32} color={colors.textFaint} />
          <AppText weight="bold" variant="heading">
            {t.jobs.empty}
          </AppText>
          <AppText color={colors.textMuted}>{t.jobs.emptyBody}</AppText>
        </Card>
      ) : null}

      {(jobs ?? []).map((job) => (
        <Pressable
          key={job.id}
          onPress={() => router.push({ pathname: '/job/[id]', params: { id: job.id } })}
          style={({ pressed }) => [styles.job, pressed && { backgroundColor: colors.surfacePressed }]}
          accessibilityRole="button"
          testID={`job-${job.id}`}
        >
          <View style={styles.jobTop}>
            <AppText weight="bold" variant="heading" style={{ flex: 1 }}>
              {packageName(t, job.packageId)}
            </AppText>
            {job.ref ? (
              <AppText variant="small" color={colors.textFaint}>
                {job.ref}
              </AppText>
            ) : null}
          </View>
          <AppText color={colors.amberText} weight="bold">
            {formatPreferred(t, job.preferredTime)}
          </AppText>
          <AppText color={colors.textMuted} numberOfLines={2}>
            {job.name} · {job.pickup}
          </AppText>
          {job.trip?.to ? (
            <AppText variant="small" color={colors.textMuted}>
              {t.job.tripTo(job.trip.to)}
            </AppText>
          ) : null}
          {sharing?.bookingId === job.id ? (
            <View style={styles.badge}>
              <Ionicons name="navigate" size={14} color={colors.success} />
              <AppText variant="small" weight="bold" color={colors.success}>
                {t.jobs.sharing}
              </AppText>
            </View>
          ) : null}
        </Pressable>
      ))}

      <View style={styles.bottom}>
        <Button
          title={t.jobs.callOffice}
          icon="call"
          variant="outline"
          onPress={() => void Linking.openURL(`tel:+91${env.officePhone}`)}
        />
        <Button
          title={t.jobs.logout}
          icon="log-out-outline"
          variant="ghost"
          compact
          onPress={confirmLogout}
        />
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingTop: space.lg,
    paddingBottom: space.md,
  },
  job: { backgroundColor: c.surface, borderRadius: radius.lg, padding: space.lg, gap: space.xs },
  jobTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    alignSelf: 'flex-start',
    backgroundColor: c.successSoft,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    marginTop: space.xs,
  },
  bottom: { gap: space.sm, marginTop: space.xl },
}));

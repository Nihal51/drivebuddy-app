import { type Booking, isActive, prettyPhone } from '@drivebuddy/shared';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Application from 'expo-application';
import { router, useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, Share, Switch, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { Notice } from '@/components/bits';
import { Button, type IconName } from '@/components/Button';
import { Card } from '@/components/Card';
import { GoogleButton } from '@/components/GoogleButton';
import { LanguageToggle } from '@/components/LanguageToggle';
import { Screen } from '@/components/Screen';
import { useConfig } from '@/config/ConfigProvider';
import { watchMyBookings } from '@/data/bookings';
import { useI18n } from '@/i18n';
import { analyticsAvailable, isAnalyticsOn, setAnalyticsOn } from '@/lib/analytics';
import { callNumber, openWebPage, openWhatsapp, sendEmail } from '@/lib/links';
import { cardShadow, makeStyles, radius, space, useTheme } from '@/theme';

/**
 * Account: a dark top with who is logged in (or the login), the numbers that
 * matter, then grouped rows — the account, preferences, help, more — like
 * the settings of any app the customer already knows. The details are
 * edited on their own screen (app/profile.tsx).
 */
export default function AccountScreen() {
  const { t } = useI18n();
  const { user, signOut } = useAuth();
  const { scheme } = useTheme();
  const styles = useStyles();

  // Light status bar icons over the dark top, while Account shows (as Home).
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      return () => setStatusBarStyle(scheme === 'dark' ? 'light' : 'dark');
    }, [scheme]),
  );

  return (
    <Screen top={user ? <ProfileTop /> : <LoginTop />}>
      {user ? <SignedIn /> : <View style={styles.gapTop} />}
      <Preferences />
      <Help />
      <More />
      {user ? (
        <Group>
          <Row
            icon="log-out-outline"
            title={t.account.signOut}
            danger
            chevron={false}
            onPress={() => void signOut()}
            testID="sign-out"
          />
        </Group>
      ) : null}
      <Footer />
    </Screen>
  );
}

/* ----------------------------------------------------------- the dark top */

function ProfileTop() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useStyles();
  const { user, profile } = useAuth();
  const name = profile?.name || user?.displayName || '';
  const initial = (name || user?.email || '?').trim().charAt(0).toUpperCase();
  return (
    <View style={[styles.top, styles.topOverlap]}>
      <View style={styles.topInner}>
        <AppText variant="display" weight="heavy" color={colors.onHero} accessibilityRole="header">
          {t.account.title}
        </AppText>
        <View style={styles.who}>
          <View style={styles.avatar}>
            <AppText variant="display" weight="heavy" color={colors.onAmber}>
              {initial}
            </AppText>
          </View>
          <View style={styles.flex}>
            {name ? (
              <AppText variant="heading" weight="heavy" color={colors.onHero} numberOfLines={1}>
                {name}
              </AppText>
            ) : null}
            {profile?.phone ? (
              <AppText variant="small" color={colors.onHeroMuted}>
                {prettyPhone(profile.phone)}
              </AppText>
            ) : null}
            {user?.email ? (
              <View style={styles.inline}>
                <Ionicons name="logo-google" size={12} color={colors.onHeroMuted} />
                <AppText variant="tiny" color={colors.onHeroMuted} numberOfLines={1} style={styles.flex}>
                  {user.email}
                </AppText>
              </View>
            ) : null}
          </View>
        </View>
        <Button
          title={t.account.editProfile}
          icon="create-outline"
          compact
          onPress={() => router.push('/profile')}
          style={styles.editButton}
          testID="edit-profile"
        />
      </View>
    </View>
  );
}

function LoginTop() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.top}>
      <View style={styles.topInner}>
        <AppText variant="display" weight="heavy" color={colors.onHero} accessibilityRole="header">
          {t.account.title}
        </AppText>
        <AppText variant="title" weight="heavy" color={colors.onHero}>
          {t.account.loginTitle}
        </AppText>
        <View style={styles.ticks}>
          {t.account.benefits.map((b) => (
            <View key={b} style={styles.inline}>
              <Ionicons name="checkmark-circle" size={18} color={colors.amber} />
              <AppText variant="small" color={colors.onHeroMuted} style={styles.flex}>
                {b}
              </AppText>
            </View>
          ))}
        </View>
        <GoogleButton onDark />
        <AppText variant="tiny" color={colors.onHeroMuted} align="center">
          {t.account.noPassword}
        </AppText>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------ logged in */

function SignedIn() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useStyles();
  const { user, profile, push, enableNotifications } = useAuth();
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const uid = user?.uid;

  useEffect(() => {
    if (!uid) return;
    return watchMyBookings(uid, setBookings, () => setBookings(null));
  }, [uid]);

  const active = bookings?.filter(isActive).length ?? 0;
  const pushOn = push === 'on';
  const goBookings = () => router.push('/bookings');
  const onNotifications = () => {
    if (push === 'off') void enableNotifications();
    else if (push === 'denied') void Linking.openSettings();
  };

  return (
    <>
      <View style={styles.stats}>
        <Stat
          value={bookings ? String(bookings.length) : '–'}
          label={t.account.statBookings}
          onPress={goBookings}
        />
        <View style={styles.vline} />
        <Stat value={bookings ? String(active) : '–'} label={t.account.statActive} onPress={goBookings} />
        <View style={styles.vline} />
        <Stat
          value={
            <Ionicons
              name={pushOn ? 'notifications' : 'notifications-off-outline'}
              size={20}
              color={pushOn ? colors.success : colors.textMuted}
            />
          }
          label={t.account.statUpdates(pushOn)}
          onPress={onNotifications}
        />
      </View>

      <Group title={t.account.yourAccount}>
        <Row
          icon="person-outline"
          title={t.account.personalDetails}
          detail={profile?.phone ? t.account.personalDetailsHint : t.account.addPhone}
          onPress={() => router.push('/profile')}
          testID="personal-details"
        />
        <Row
          icon="calendar-outline"
          title={t.account.myBookings}
          detail={t.account.bookingsDetail(active)}
          onPress={goBookings}
        />
        <Row
          icon="notifications-outline"
          title={t.account.notifications}
          detail={
            push === 'denied'
              ? t.account.notificationsDenied
              : push === 'unsupported'
                ? t.account.notificationsUnavailable
                : t.account.notificationsDetail
          }
          right={
            push === 'unsupported' ? null : (
              <Pill
                text={
                  pushOn
                    ? t.account.on
                    : push === 'denied'
                      ? t.account.blocked
                      : t.account.notificationsTurnOn
                }
                tone={pushOn ? 'ok' : 'off'}
              />
            )
          }
          onPress={pushOn || push === 'unsupported' ? undefined : onNotifications}
          testID="notifications-row"
        />
      </Group>
    </>
  );
}

function Stat({ value, label, onPress }: { value: ReactNode; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.stat, pressed && styles.pressed]}
    >
      <View style={styles.statValue}>
        {typeof value === 'string' ? (
          <AppText variant="title" weight="heavy">
            {value}
          </AppText>
        ) : (
          value
        )}
      </View>
      <AppText variant="tiny" color={colors.textMuted}>
        {label}
      </AppText>
    </Pressable>
  );
}

function Pill({ text, tone }: { text: string; tone: 'ok' | 'off' }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.pill, tone === 'ok' ? styles.pillOk : styles.pillOff]}>
      <AppText variant="tiny" weight="bold" color={tone === 'ok' ? colors.success : colors.amberText}>
        {text}
      </AppText>
    </View>
  );
}

/* ------------------------------------------------------------ for everyone */

function Preferences() {
  const { t } = useI18n();
  return (
    <Group title={t.account.preferences}>
      <Row
        icon="language-outline"
        title={t.account.language}
        right={<LanguageToggle size="small" />}
        chevron={false}
      />
      {analyticsAvailable() ? <StatsRow /> : null}
    </Group>
  );
}

/** Anonymous usage stats, on unless the customer turns them off (src/lib/analytics.ts). */
function StatsRow() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    void isAnalyticsOn().then((v) => alive && setOn(v));
    return () => {
      alive = false;
    };
  }, []);
  if (on === null) return null;
  return (
    <Row
      icon="stats-chart-outline"
      title={t.account.statsTitle}
      detail={t.account.statsBody}
      chevron={false}
      right={
        <Switch
          value={on}
          onValueChange={(v) => {
            setOn(v);
            void setAnalyticsOn(v);
          }}
          trackColor={{ true: colors.amber, false: colors.line }}
          thumbColor={colors.white}
          accessibilityLabel={t.account.statsTitle}
          testID="stats-toggle"
        />
      }
    />
  );
}

function Help() {
  const { t } = useI18n();
  const { config } = useConfig();
  const c = config.contact;
  return (
    <Group title={t.account.helpSupport}>
      <Row
        icon="call-outline"
        title={t.account.callUs}
        detail={t.account.callDetail(prettyPhone(c.phone))}
        onPress={() => void callNumber(c.phone)}
      />
      <Row
        icon="logo-whatsapp"
        title={t.common.whatsapp}
        detail={prettyPhone(c.whatsapp)}
        onPress={() => void openWhatsapp(c.whatsapp)}
      />
      <Row
        icon="mail-outline"
        title={t.common.email}
        detail={c.email}
        onPress={() => void sendEmail(c.email, 'DriveBuddy app')}
      />
    </Group>
  );
}

function More() {
  const { t } = useI18n();
  const { config } = useConfig();
  const shareUrl = config.app.playStoreUrl || config.site.url;
  return (
    <Group title={t.account.more}>
      {config.google.writeReview ? (
        <Row
          icon="star-outline"
          title={t.account.rate}
          detail={t.account.rateDetail}
          onPress={() => void openWebPage(config.google.writeReview)}
          testID="rate-google"
        />
      ) : null}
      <Row
        icon="share-social-outline"
        title={t.account.share}
        detail={t.account.shareDetail}
        onPress={() => void Share.share({ message: t.account.shareText(shareUrl) }).catch(() => {})}
        testID="share-app"
      />
      <Row
        icon="globe-outline"
        title={t.account.website}
        detail={config.site.url.replace('https://', '')}
        onPress={() => void openWebPage(config.site.url)}
      />
      <Row
        icon="shield-checkmark-outline"
        title={t.account.privacy}
        onPress={() => void openWebPage(config.site.privacy)}
      />
      <Row
        icon="document-text-outline"
        title={t.account.terms}
        onPress={() => void openWebPage(config.site.terms)}
      />
    </Group>
  );
}

function Footer() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useStyles();
  const { user } = useAuth();
  const version = Application.nativeApplicationVersion ?? '1.0.0';
  const build = Application.nativeBuildVersion;
  return (
    <View style={styles.footer}>
      {user ? <DeleteAccount /> : null}
      <AppText variant="tiny" color={colors.textFaint} align="center">
        {t.account.version(build ? `${version} (${build})` : version)}
      </AppText>
    </View>
  );
}

/** Asked twice on purpose: a link, then a plain explanation with the real button. */
function DeleteAccount() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useStyles();
  const { deleteAccount } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!open) {
    return (
      <Button
        title={t.account.deleteLink}
        variant="ghost"
        compact
        onPress={() => setOpen(true)}
        testID="delete-account"
      />
    );
  }
  return (
    <Card style={styles.danger}>
      <AppText variant="heading" weight="heavy">
        {t.account.deleteTitle}
      </AppText>
      <AppText variant="small" color={colors.textMuted}>
        {t.account.deleteBody}
      </AppText>
      {failed ? <Notice text={t.account.deleteFailed} tone="danger" /> : null}
      <Button
        title={t.account.deleteConfirm}
        icon="trash-outline"
        variant="dark"
        loading={busy}
        onPress={async () => {
          setBusy(true);
          setFailed(false);
          const result = await deleteAccount();
          setBusy(false);
          if (result === 'failed') setFailed(true);
        }}
        testID="confirm-delete-account"
      />
      <Button title={t.common.cancel} variant="outline" onPress={() => setOpen(false)} />
    </Card>
  );
}

/* ------------------------------------------------------- grouped rows */

function Group({ title, children }: { title?: string; children: ReactNode }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.group}>
      {title ? (
        <AppText
          variant="tiny"
          weight="bold"
          color={colors.textFaint}
          style={styles.groupTitle}
          accessibilityRole="header"
        >
          {title.toUpperCase()}
        </AppText>
      ) : null}
      <View style={styles.list}>{children}</View>
    </View>
  );
}

function Row({
  icon,
  title,
  detail,
  right,
  onPress,
  danger = false,
  chevron = true,
  testID,
}: {
  icon: IconName;
  title: string;
  detail?: string;
  right?: ReactNode;
  onPress?: () => void;
  danger?: boolean;
  chevron?: boolean;
  testID?: string;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const body = (
    <>
      <View style={[styles.icon, danger ? styles.iconDanger : null]}>
        <Ionicons name={icon} size={19} color={danger ? colors.danger : colors.amberText} />
      </View>
      <View style={styles.flex}>
        <AppText weight="bold" color={danger ? colors.danger : colors.text}>
          {title}
        </AppText>
        {detail ? (
          <AppText variant="small" color={colors.textMuted}>
            {detail}
          </AppText>
        ) : null}
      </View>
      {right}
      {onPress && chevron && !right ? (
        <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
      ) : null}
    </>
  );
  if (!onPress) {
    return (
      <View style={styles.row} testID={testID}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={detail ? `${title}, ${detail}` : title}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
      testID={testID}
    >
      {body}
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  gapTop: { height: space.sm },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  top: {
    alignSelf: 'stretch',
    alignItems: 'center',
    backgroundColor: c.hero,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.xl,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  // Room for the numbers card that overlaps the bottom of the dark top.
  topOverlap: { paddingBottom: space.xxl + space.xl, marginBottom: -(space.xxl + space.sm) },
  topInner: { width: '100%', maxWidth: 640, gap: space.md },
  who: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: c.amber,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: c.heroSoft,
  },
  editButton: { alignSelf: 'flex-start' },
  ticks: { gap: space.sm },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.background,
    borderRadius: radius.lg + 4,
    borderWidth: 1,
    borderColor: c.line,
    paddingVertical: space.sm,
    ...cardShadow(c),
  },
  stat: { flex: 1, alignItems: 'center', paddingVertical: space.xs, borderRadius: radius.md },
  statValue: { height: 28, justifyContent: 'center' },
  vline: { width: 1, height: 34, backgroundColor: c.line },
  pill: { borderRadius: radius.pill, paddingHorizontal: space.sm + 2, paddingVertical: 4 },
  pillOk: { backgroundColor: c.successSoft },
  pillOff: { backgroundColor: c.amberSoft },
  group: { gap: space.sm },
  groupTitle: { marginLeft: space.xs, letterSpacing: 0.8 },
  list: { backgroundColor: c.surface, borderRadius: radius.lg + 4, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md + 2,
    paddingVertical: space.md,
    minHeight: 60,
    borderBottomWidth: 1,
    borderBottomColor: c.background,
  },
  pressed: { backgroundColor: c.surfacePressed },
  icon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: c.amberSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconDanger: { backgroundColor: c.dangerSoft },
  footer: { gap: space.sm, alignItems: 'center', paddingBottom: space.lg },
  danger: { alignSelf: 'stretch', borderWidth: 1, borderColor: c.dangerSoft },
}));

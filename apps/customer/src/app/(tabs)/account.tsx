import { type ProfileErrors, prettyPhone, validateProfile } from '@drivebuddy/shared';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Application from 'expo-application';
import { useEffect, useState } from 'react';
import { Linking, Pressable, Switch, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { Notice, SectionTitle } from '@/components/bits';
import { Button, type IconName } from '@/components/Button';
import { Card } from '@/components/Card';
import { GoogleButton } from '@/components/GoogleButton';
import { LanguageToggle } from '@/components/LanguageToggle';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { useConfig } from '@/config/ConfigProvider';
import { useI18n } from '@/i18n';
import { errorText } from '@/i18n/format';
import { analyticsAvailable, isAnalyticsOn, setAnalyticsOn } from '@/lib/analytics';
import { callNumber, openWebPage, openWhatsapp, sendEmail } from '@/lib/links';
import { makeStyles, radius, space, useTheme } from '@/theme';

export default function AccountScreen() {
  const { t } = useI18n();
  const { user } = useAuth();

  return (
    <Screen>
      <AppText variant="title" weight="heavy" accessibilityRole="header">
        {t.account.title}
      </AppText>

      {user ? <SignedIn /> : <SignedOut />}

      <SectionTitle>{t.account.language}</SectionTitle>
      <LanguageToggle />

      {analyticsAvailable() ? <StatsToggle /> : null}

      <HelpLinks />
    </Screen>
  );
}

function SignedOut() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Card>
      <AppText variant="heading" weight="heavy">
        {t.account.signedOutTitle}
      </AppText>
      {t.account.benefits.map((b) => (
        <View key={b} style={styles.benefit}>
          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          <AppText style={styles.flex}>{b}</AppText>
        </View>
      ))}
      <GoogleButton />
    </Card>
  );
}

function SignedIn() {
  const { profile } = useAuth();
  // Keyed on the stored values: the form starts from them, and restarts if they change elsewhere.
  return <ProfileForm key={`${profile?.name ?? ''}|${profile?.phone ?? ''}`} />;
}

function ProfileForm() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useStyles();
  const { user, profile, saveProfile, signOut } = useAuth();
  const [name, setName] = useState(profile?.name ?? '');
  const [phone, setPhone] = useState(profile?.phone ? prettyPhone(profile.phone) : '');
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);

  const onSave = async () => {
    const next = { name, phone, email: user?.email ?? '' };
    const found = validateProfile(next);
    setErrors(found);
    setSaved(false);
    setFailed(false);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      await saveProfile(next);
      setSaved(true);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  const initial = (profile?.name || user?.email || '?').trim().charAt(0).toUpperCase();

  return (
    <>
      <View style={styles.who}>
        <View style={styles.avatar}>
          <AppText variant="title" weight="heavy" color={colors.onAmber}>
            {initial}
          </AppText>
        </View>
        <View style={styles.flex}>
          <AppText weight="heavy">{profile?.name || user?.displayName || ''}</AppText>
          <AppText variant="small" color={colors.textMuted}>
            {user?.email ?? ''}
          </AppText>
        </View>
      </View>

      <Card>
        <AppText variant="heading" weight="heavy">
          {t.account.profile}
        </AppText>
        <AppText variant="small" color={colors.textMuted}>
          {t.account.profileHint}
        </AppText>
        <TextField
          label={t.book.name}
          value={name}
          onChangeText={setName}
          error={errors.name ? errorText(t, 'name', errors.name) : undefined}
          autoComplete="name"
          maxLength={60}
        />
        <TextField
          label={t.book.phone}
          prefix="+91"
          value={phone}
          onChangeText={setPhone}
          error={errors.phone ? errorText(t, 'phone', errors.phone) : undefined}
          keyboardType="phone-pad"
          autoComplete="tel"
          maxLength={16}
        />
        {failed ? <Notice text={t.authErrors.unknown} tone="danger" /> : null}
        <Button
          title={saved ? t.common.saved : t.common.save}
          icon={saved ? 'checkmark' : 'save-outline'}
          loading={saving}
          onPress={() => void onSave()}
        />
      </Card>

      <NotificationsCard />

      <Button
        title={t.account.signOut}
        icon="log-out-outline"
        variant="outline"
        onPress={() => void signOut()}
      />
      <DeleteAccount />
    </>
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

/** Anonymous usage stats, on unless the customer turns them off (src/lib/analytics.ts). */
function StatsToggle() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useStyles();
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
    <View style={styles.statsRow}>
      <View style={styles.flex}>
        <AppText weight="bold">{t.account.statsTitle}</AppText>
        <AppText variant="small" color={colors.textMuted}>
          {t.account.statsBody}
        </AppText>
      </View>
      <Switch
        value={on}
        onValueChange={(v) => {
          setOn(v);
          void setAnalyticsOn(v);
        }}
        trackColor={{ true: colors.amber, false: colors.line }}
        thumbColor={colors.surface}
        accessibilityLabel={t.account.statsTitle}
        testID="stats-toggle"
      />
    </View>
  );
}

function NotificationsCard() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useStyles();
  const { push, enableNotifications } = useAuth();
  const [busy, setBusy] = useState(false);
  return (
    <Card>
      <View style={styles.benefit}>
        <Ionicons
          name={push === 'on' ? 'notifications' : 'notifications-off-outline'}
          size={22}
          color={push === 'on' ? colors.success : colors.textMuted}
        />
        <AppText variant="heading" weight="heavy" style={styles.flex}>
          {t.account.notifications}
        </AppText>
      </View>
      <AppText variant="small" color={colors.textMuted}>
        {push === 'on'
          ? t.account.notificationsOn
          : push === 'denied'
            ? t.account.notificationsDenied
            : push === 'unsupported'
              ? t.account.notificationsUnavailable
              : t.account.notificationsOff}
      </AppText>
      {push === 'off' ? (
        <Button
          title={t.account.notificationsTurnOn}
          icon="notifications-outline"
          loading={busy}
          onPress={async () => {
            setBusy(true);
            await enableNotifications();
            setBusy(false);
          }}
        />
      ) : null}
      {push === 'denied' ? (
        <Button
          title={t.account.openSettings}
          variant="outline"
          onPress={() => void Linking.openSettings()}
        />
      ) : null}
    </Card>
  );
}

function HelpLinks() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useStyles();
  const { config } = useConfig();
  const c = config.contact;
  const rows: { icon: IconName; label: string; detail?: string; onPress: () => void }[] = [
    {
      icon: 'call-outline',
      label: t.common.call,
      detail: prettyPhone(c.phone),
      onPress: () => void callNumber(c.phone),
    },
    {
      icon: 'logo-whatsapp',
      label: t.common.whatsapp,
      detail: prettyPhone(c.whatsapp),
      onPress: () => void openWhatsapp(c.whatsapp),
    },
    {
      icon: 'mail-outline',
      label: t.common.email,
      detail: c.email,
      onPress: () => void sendEmail(c.email, 'DriveBuddy app'),
    },
    {
      icon: 'globe-outline',
      label: t.account.website,
      detail: config.site.url.replace('https://', ''),
      onPress: () => void openWebPage(config.site.url),
    },
    {
      icon: 'shield-checkmark-outline',
      label: t.account.privacy,
      onPress: () => void openWebPage(config.site.privacy),
    },
    {
      icon: 'document-text-outline',
      label: t.account.terms,
      onPress: () => void openWebPage(config.site.terms),
    },
  ];
  const version = Application.nativeApplicationVersion ?? '1.0.0';
  const build = Application.nativeBuildVersion;
  return (
    <>
      <SectionTitle>{t.account.help}</SectionTitle>
      <View style={styles.list}>
        {rows.map((r, i) => (
          <Pressable
            key={r.label}
            onPress={r.onPress}
            accessibilityRole="link"
            accessibilityLabel={r.detail ? `${r.label}, ${r.detail}` : r.label}
            style={({ pressed }) => [
              styles.linkRow,
              i > 0 ? styles.divider : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <Ionicons name={r.icon} size={20} color={colors.amberText} />
            <View style={styles.flex}>
              <AppText weight="bold">{r.label}</AppText>
              {r.detail ? (
                <AppText variant="small" color={colors.textMuted}>
                  {r.detail}
                </AppText>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
          </Pressable>
        ))}
      </View>
      <AppText variant="tiny" color={colors.textFaint} align="center">
        {t.account.version(build ? `${version} (${build})` : version)}
      </AppText>
    </>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  who: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: c.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.line,
    overflow: 'hidden',
  },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, minHeight: 56 },
  divider: { borderTopWidth: 1, borderTopColor: c.line },
  pressed: { backgroundColor: c.cream },
  danger: { borderColor: c.danger },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
}));

import { type ProfileErrors, prettyPhone, validateProfile } from '@drivebuddy/shared';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { Notice } from '@/components/bits';
import { Button } from '@/components/Button';
import { GoogleButton } from '@/components/GoogleButton';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { useI18n } from '@/i18n';
import { errorText } from '@/i18n/format';
import { makeStyles, radius, space, useTheme } from '@/theme';

/**
 * Personal details, opened from Account: the name and mobile number that
 * fill in every new booking. The email comes from the Google login and is
 * shown, not edited. Saving goes back to Account.
 */
export default function ProfileScreen() {
  const { user, profile } = useAuth();
  if (!user) return <LoggedOut />;
  // Keyed on the stored values: the form starts from them, and restarts if they change elsewhere.
  return <ProfileForm key={`${profile?.name ?? ''}|${profile?.phone ?? ''}`} />;
}

function LoggedOut() {
  const styles = useStyles();
  return (
    <Screen edges={['bottom']}>
      <View style={styles.center}>
        <GoogleButton />
      </View>
    </Screen>
  );
}

function ProfileForm() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useStyles();
  const { user, profile, saveProfile } = useAuth();
  const [name, setName] = useState(profile?.name ?? user?.displayName ?? '');
  const [phone, setPhone] = useState(
    profile?.phone ? prettyPhone(profile.phone).replace(/^\+91\s*/, '') : '',
  );
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const onSave = async () => {
    const next = { name, phone, email: user?.email ?? '' };
    const found = validateProfile(next);
    setErrors(found);
    setFailed(false);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      await saveProfile(next);
      if (router.canGoBack()) router.back();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  const initial = (name || user?.email || '?').trim().charAt(0).toUpperCase();

  return (
    <Screen
      edges={['bottom']}
      footer={
        <View style={styles.footer}>
          {failed ? <Notice text={t.authErrors.unknown} tone="danger" /> : null}
          <Button
            title={t.account.saveChanges}
            icon="checkmark"
            loading={saving}
            onPress={() => void onSave()}
            testID="save-profile"
          />
        </View>
      }
    >
      <View style={styles.avatar}>
        <AppText variant="display" weight="heavy" color={colors.onAmber}>
          {initial}
        </AppText>
      </View>
      <TextField
        label={t.account.fullName}
        value={name}
        onChangeText={setName}
        error={errors.name ? errorText(t, 'name', errors.name) : undefined}
        autoComplete="name"
        maxLength={60}
        testID="profile-name"
      />
      <TextField
        label={t.account.mobile}
        prefix="+91"
        value={phone}
        onChangeText={setPhone}
        error={errors.phone ? errorText(t, 'phone', errors.phone) : undefined}
        hint={t.account.mobileHint}
        keyboardType="phone-pad"
        autoComplete="tel"
        maxLength={16}
        testID="profile-phone"
      />
      {user?.email ? (
        <TextField
          label={t.account.email}
          value={user.email}
          editable={false}
          hint={t.account.emailHint}
          testID="profile-email"
        />
      ) : null}
      <View style={styles.note}>
        <Ionicons name="information-circle-outline" size={18} color={colors.amberText} />
        <AppText variant="small" color={colors.textMuted} style={styles.flex}>
          {t.account.autofillNote}
        </AppText>
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  center: { paddingTop: space.xl },
  avatar: {
    alignSelf: 'center',
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: c.amber,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: space.sm,
  },
  note: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'flex-start',
    backgroundColor: c.cream,
    borderRadius: radius.md,
    padding: space.md,
  },
  footer: { width: '100%', maxWidth: 640, gap: space.sm },
}));

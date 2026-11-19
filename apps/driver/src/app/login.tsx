/**
 * Login: mobile number → SMS code → in. The alerts robot sends the code only
 * to numbers on a Verified or Active driver record, at most 3 a day each.
 */

import { Redirect } from 'expo-router';
import { useRef, useState } from 'react';
import { Linking, type TextInput, View } from 'react-native';

import { useDriverAuth } from '@/auth/DriverAuth';
import { type Failed, requestCode, tenDigits, verifyCode } from '@/auth/robot';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { env } from '@/env';
import { useI18n } from '@/i18n';
import { loginErrorText, spacedPhone } from '@/i18n/format';
import { makeStyles, space, useTheme } from '@/theme';

export default function LoginScreen() {
  const { t, lang, setLang } = useI18n();
  const { colors } = useTheme();
  const styles = useStyles();
  const { state, logIn } = useDriverAuth();

  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [session, setSession] = useState<{ id: string; phone: string; left: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const codeInput = useRef<TextInput>(null);

  if (state.status === 'in') return <Redirect href="/" />;

  const fail = (f: Failed) => setError(loginErrorText(t, f));

  const send = async () => {
    const ten = tenDigits(phone);
    if (!ten) {
      setError(t.login.errors['bad-phone']);
      return;
    }
    setBusy(true);
    setError(null);
    const res = await requestCode(ten);
    setBusy(false);
    if (!res.ok) return fail(res);
    setSession({ id: res.session, phone: ten, left: res.left });
    setCode('');
    setTimeout(() => codeInput.current?.focus(), 300);
  };

  const verify = async () => {
    if (!session) return;
    setBusy(true);
    setError(null);
    const res = await verifyCode(session.id, code.replace(/\D/g, ''));
    if (!res.ok) {
      setBusy(false);
      if (res.error === 'expired' || res.error === 'too-many-tries') setSession(null);
      return fail(res);
    }
    try {
      await logIn(res.token, res.name, res.phone);
    } catch {
      setBusy(false);
      setError(t.login.errors.network);
    }
  };

  return (
    <Screen
      edges={['top', 'bottom']}
      footer={
        <View style={styles.footer}>
          {session ? (
            <Button
              title={t.login.verify}
              icon="log-in"
              onPress={verify}
              loading={busy}
              disabled={code.replace(/\D/g, '').length < 4}
            />
          ) : (
            <Button title={t.login.sendCode} icon="chatbubble-ellipses" onPress={send} loading={busy} />
          )}
          <Button
            title={t.jobs.callOffice}
            icon="call"
            variant="ghost"
            compact
            onPress={() => void Linking.openURL(`tel:+91${env.officePhone}`)}
          />
        </View>
      }
    >
      <View style={styles.top}>
        <Button
          title={t.language.toggle}
          variant="outline"
          compact
          onPress={() => setLang(lang === 'hi' ? 'en' : 'hi')}
          style={styles.lang}
        />
        <AppText variant="display" weight="heavy">
          {t.login.title}
        </AppText>
        <AppText color={colors.textMuted}>{t.login.subtitle}</AppText>
      </View>

      {session ? (
        <View style={styles.block}>
          <AppText weight="bold">{t.login.codeTitle(spacedPhone(session.phone))}</AppText>
          <TextField
            ref={codeInput}
            label={t.login.codeLabel}
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 8))}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            maxLength={8}
            error={error ?? undefined}
            testID="code"
          />
          <AppText variant="small" color={colors.textFaint}>
            {t.login.codesLeft(session.left)}
          </AppText>
          <Button
            title={t.login.changeNumber}
            variant="ghost"
            compact
            onPress={() => {
              setSession(null);
              setError(null);
            }}
          />
        </View>
      ) : (
        <View style={styles.block}>
          <TextField
            label={t.login.phoneLabel}
            prefix="+91"
            value={phone}
            onChangeText={setPhone}
            placeholder={t.login.phonePlaceholder}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            autoComplete="tel"
            maxLength={14}
            error={error ?? undefined}
            onSubmitEditing={send}
            testID="phone"
          />
        </View>
      )}
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  top: { gap: space.sm, paddingTop: space.xl, paddingBottom: space.xl },
  lang: { alignSelf: 'flex-end' },
  block: { gap: space.md },
  footer: { gap: space.sm },
}));

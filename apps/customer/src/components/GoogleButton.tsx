import { useState } from 'react';
import { View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { isGoogleLoginAvailable } from '@/firebase/google';
import { useI18n } from '@/i18n';

import { Notice } from './bits';
import { Button } from './Button';

/** "Continue with Google", with its own error line. Hidden when login is not set up in this build. */
export function GoogleButton() {
  const { t } = useI18n();
  const { signIn } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isGoogleLoginAvailable()) return <Notice text={t.account.loginUnavailable} tone="grey" />;

  const onPress = async () => {
    setBusy(true);
    setError(null);
    const result = await signIn();
    setBusy(false);
    if (!result.ok && 'error' in result) setError(t.authErrors[result.error]);
  };

  return (
    <View style={{ gap: 8 }}>
      <Button
        title={busy ? t.account.signingIn : t.account.google}
        icon="logo-google"
        variant="dark"
        loading={busy}
        onPress={() => void onPress()}
        testID="google-login"
      />
      {error ? <Notice text={error} tone="danger" /> : null}
    </View>
  );
}

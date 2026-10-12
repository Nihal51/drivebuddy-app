import { router } from 'expo-router';

import { EmptyState } from '@/components/bits';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { useI18n } from '@/i18n';

export default function NotFoundScreen() {
  const { t } = useI18n();
  return (
    <Screen edges={['bottom']}>
      <EmptyState icon="compass-outline" title={t.notFound.title}>
        <Button title={t.notFound.home} icon="home" onPress={() => router.replace('/')} />
      </EmptyState>
    </Screen>
  );
}

import { StyleSheet, View } from 'react-native';

import { useConfig } from '@/config/ConfigProvider';
import { useI18n } from '@/i18n';
import { callNumber, openWhatsapp } from '@/lib/links';
import { space } from '@/theme';

import { Button } from './Button';

/** Call / WhatsApp DriveBuddy, side by side. `message` pre-types the WhatsApp text. */
export function ContactActions({ message, compact }: { message?: string; compact?: boolean }) {
  const { t } = useI18n();
  const { contact } = useConfig().config;
  return (
    <View style={styles.row}>
      <Button
        title={t.common.call}
        icon="call"
        variant="outline"
        compact={compact}
        onPress={() => void callNumber(contact.phone)}
        style={styles.half}
      />
      <Button
        title={t.common.whatsapp}
        icon="logo-whatsapp"
        variant="whatsapp"
        compact={compact}
        onPress={() => void openWhatsapp(contact.whatsapp, message)}
        style={styles.half}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm },
  half: { flex: 1 },
});

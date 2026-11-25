import { type Booking, finalTrainPrice, returnChoiceFields, rupees, seatsLink } from '@drivebuddy/shared';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Notice } from '@/components/bits';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useConfig } from '@/config/ConfigProvider';
import { chooseReturnTrain } from '@/data/selfserve';
import { useI18n } from '@/i18n';
import { formatDateTime } from '@/i18n/format';
import { makeStyles, radius, space, useTheme } from '@/theme';

/**
 * After the drop on a one-way drop over 160 km (SPEC-v4 §2): the trains home
 * the robot found for the driver, with the whole price with each. The
 * customer books his ticket — "Check seats ↗" opens the railway's seat page;
 * nothing here checks seats — then taps "I booked this train". After that:
 * "Final price ₹2,650 · train 18452" (the robot's returnPrice).
 */
export function ReturnTrainsCard({ booking: b }: { booking: Booking }) {
  const { t } = useI18n();
  const { config } = useConfig();
  const { colors } = useTheme();
  const styles = useStyles();
  const [busy, setBusy] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const check = b.returnCheck;
  if (!check) return null;
  const at = (d?: Date) => (d ? formatDateTime(t, d) : '?');
  const city = t.cities[b.city as keyof typeof t.cities] ?? b.city;

  if (b.returnChoice) {
    const price = finalTrainPrice(b);
    return (
      <Card tone="cream">
        <View style={styles.row}>
          <Ionicons name="train" size={20} color={colors.amberText} />
          <AppText weight="heavy" style={styles.flex} testID="return-chosen">
            {price !== null
              ? t.detail.trains.final(rupees(price), b.returnChoice.train)
              : t.detail.trains.chosen(b.returnChoice.train)}
          </AppText>
        </View>
      </Card>
    );
  }

  const choose = async (train: string) => {
    const fields = returnChoiceFields(b, train);
    if (!fields.ok) return;
    setBusy(train);
    setProblem(null);
    const res = await chooseReturnTrain(b.id, fields.train, fields.dep, config.alerts.pingUrl);
    setBusy('');
    if (!res.ok)
      setProblem(res.reason === 'permission' ? t.detail.trains.refused : t.detail.trains.saveFailed);
  };

  return (
    <Card tone="cream">
      <AppText variant="small" weight="heavy" color={colors.amberText}>
        {t.detail.trains.title.toUpperCase()}
      </AppText>
      <AppText weight="bold">{t.detail.trains.dropped}</AppText>
      {check.failed ? (
        <Notice text={t.detail.trains.failed} tone="grey" />
      ) : check.options.length === 0 ? (
        <Notice text={t.detail.trains.none} tone="grey" />
      ) : (
        <View style={styles.list}>
          {check.options.slice(0, 3).map((o) => {
            const seats = seatsLink(o.train);
            const can = returnChoiceFields(b, o.train).ok;
            return (
              <View
                key={`${o.train}-${o.dep?.getTime() ?? ''}`}
                style={styles.option}
                testID={`return-${o.train}`}
              >
                <AppText weight="bold">
                  {o.train} {o.name}
                </AppText>
                <AppText variant="small" color={colors.textMuted}>
                  {t.detail.trains.leaves(at(o.dep), city, at(o.arr))}
                  {o.change ? t.detail.trains.change(o.change.station, o.change.train) : ''}
                </AppText>
                <AppText weight="heavy">{t.detail.trains.total(rupees(o.price))}</AppText>
                <View style={styles.actions}>
                  {seats ? (
                    <Pressable
                      onPress={() => void Linking.openURL(seats).catch(() => {})}
                      accessibilityRole="link"
                      hitSlop={8}
                      testID={`return-seats-${o.train}`}
                    >
                      <AppText variant="small" weight="bold" color={colors.amberText}>
                        {t.detail.trains.checkSeats}
                      </AppText>
                    </Pressable>
                  ) : null}
                  {can ? (
                    <Button
                      title={t.detail.trains.booked}
                      icon="checkmark-circle"
                      compact
                      loading={busy === o.train}
                      disabled={busy !== '' && busy !== o.train}
                      onPress={() => void choose(o.train)}
                      testID={`return-book-${o.train}`}
                    />
                  ) : null}
                </View>
              </View>
            );
          })}
          <AppText variant="tiny" color={colors.textMuted}>
            {t.detail.trains.noSeatCheck}
          </AppText>
        </View>
      )}
      {check.bus && check.options.length > 0 ? (
        <AppText variant="small" color={colors.textMuted}>
          {t.detail.trains.lateFirst}
        </AppText>
      ) : null}
      {problem ? <Notice text={problem} tone="danger" /> : null}
    </Card>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  list: { gap: space.sm },
  option: {
    gap: space.xs,
    padding: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.creamLine,
    backgroundColor: c.background,
  },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
}));

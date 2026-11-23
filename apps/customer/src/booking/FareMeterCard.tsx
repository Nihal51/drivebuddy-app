import { type AppConfig, type Booking, fareMeter, rupees } from '@drivebuddy/shared';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { useI18n } from '@/i18n';
import { meterBreakdown, meterTime } from '@/i18n/format';
import { makeStyles, space, useTheme } from '@/theme';

/** Often enough for the minutes to move on screen; the money moves by the hour at most. */
const TICK_MS = 30_000;

/**
 * The live fare while the driver is on the job (packages/shared meter.ts has
 * the rules — the robot's): a local job from his Arrived tap, "so far ₹X"
 * with the package and the extra hours; a trip from his Start, the estimate
 * (from his real time once it runs past what was booked). Nothing until the
 * start time is known. Not a bill: that comes when the job ends.
 */
export function FareMeterCard({ booking, config }: { booking: Booking; config: AppConfig }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useStyles();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const meter = fareMeter(booking, config, now);
  if (!meter) return null;
  const time = meterTime(t, meter.minutes);

  return (
    <Card>
      <View style={styles.row} testID="fare-meter">
        <Ionicons name="speedometer-outline" size={18} color={colors.amberText} />
        <AppText variant="small" weight="heavy" color={colors.amberText}>
          {t.detail.meter.title.toUpperCase()}
        </AppText>
      </View>
      {meter.kind === 'local' ? (
        <>
          <AppText weight="heavy">{t.detail.meter.withYou(time, rupees(meter.amount))}</AppText>
          <AppText variant="small" color={colors.textMuted}>
            {meterBreakdown(t, meter)}
          </AppText>
        </>
      ) : (
        <>
          <AppText weight="heavy">
            {meter.amount !== null
              ? t.detail.meter.onTrip(time, rupees(meter.amount))
              : t.detail.meter.onTripTime(time)}
          </AppText>
          {meter.overBooked ? (
            <AppText variant="small" color={colors.textMuted}>
              {t.detail.meter.overBooked}
            </AppText>
          ) : null}
        </>
      )}
      <AppText variant="small" color={colors.textFaint}>
        {t.detail.meter.note}
      </AppText>
    </Card>
  );
}

const useStyles = makeStyles(() => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
}));

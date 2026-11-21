import { type Booking, RATING_COMMENT_MAX } from '@drivebuddy/shared';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Notice } from '@/components/bits';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { TextField } from '@/components/TextField';
import { useConfig } from '@/config/ConfigProvider';
import { ratedOnPhone, ratingState, rememberRated, submitRating } from '@/data/selfserve';
import { useI18n } from '@/i18n';
import { openWebPage } from '@/lib/links';
import { TOUCH, makeStyles, space, useTheme } from '@/theme';

type Phase =
  | { kind: 'checking' }
  | { kind: 'open' }
  | { kind: 'sending' }
  /** stars: what was given on this phone; 0 when it was rated before (stars unknown). */
  | { kind: 'thanks'; stars: number }
  | { kind: 'already' };

const STARS = [1, 2, 3, 4, 5] as const;

/**
 * Rate the driver after the job (spec item 7): 1–5 stars and an optional
 * comment → ratings/{bookingId}, created once. The screen shows it only when
 * canRate. A 5-star rating is followed by the Google review link, when the
 * site has one.
 */
export function RatingCard({ booking, uid }: { booking: Booking; uid: string }) {
  const { t } = useI18n();
  const { config } = useConfig();
  const { colors } = useTheme();
  const styles = useStyles();
  const [phase, setPhase] = useState<Phase>({ kind: 'checking' });
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [failed, setFailed] = useState(false);
  const driverId = booking.assignedDriver?.id ?? '';
  const driverName = booking.assignedDriver?.name ?? '';

  useEffect(() => {
    let alive = true;
    void (async () => {
      // Rated on this phone: thank them without asking the server.
      const mine = await ratedOnPhone(booking.id);
      if (mine !== null) {
        if (alive) setPhase({ kind: 'thanks', stars: mine });
        return;
      }
      // 'unknown' (customers may not read ratings): let them try once.
      const state = await ratingState(booking.id);
      if (alive) setPhase(state === 'rated' ? { kind: 'already' } : { kind: 'open' });
    })();
    return () => {
      alive = false;
    };
  }, [booking.id]);

  async function send() {
    setPhase({ kind: 'sending' });
    setFailed(false);
    const res = await submitRating(booking.id, stars, comment, driverId, uid);
    if (res === 'ok') {
      void rememberRated(booking.id, stars);
      setPhase({ kind: 'thanks', stars });
    } else if (res === 'already') {
      void rememberRated(booking.id, 0);
      setPhase({ kind: 'already' });
    } else {
      setFailed(true);
      setPhase({ kind: 'open' });
    }
  }

  if (phase.kind === 'checking') {
    return (
      <Card>
        <ActivityIndicator color={colors.amber} />
      </Card>
    );
  }

  if (phase.kind === 'thanks' || phase.kind === 'already') {
    const askGoogle = phase.kind === 'thanks' && phase.stars === 5 && Boolean(config.google.writeReview);
    return (
      <Card tone="cream">
        <View style={styles.row}>
          <Ionicons name="heart" size={20} color={colors.amberText} />
          <AppText weight="heavy" style={styles.flex}>
            {phase.kind === 'thanks' ? t.detail.rate.thanks : t.detail.rate.already}
          </AppText>
        </View>
        {askGoogle ? (
          <>
            <AppText variant="small" color={colors.textMuted}>
              {t.detail.rate.googleAsk}
            </AppText>
            <Button
              testID="google-review"
              title={t.detail.reviewButton}
              icon="star"
              variant="outline"
              onPress={() => void openWebPage(config.google.writeReview)}
            />
          </>
        ) : null}
      </Card>
    );
  }

  const sending = phase.kind === 'sending';
  return (
    <Card tone="cream">
      <AppText weight="heavy">{t.detail.rate.title(driverName)}</AppText>
      <AppText variant="small" color={colors.textMuted}>
        {t.detail.rate.body}
      </AppText>
      <View style={styles.stars} accessibilityRole="radiogroup">
        {STARS.map((n) => (
          <Pressable
            key={n}
            testID={`star-${n}`}
            onPress={() => setStars(n)}
            disabled={sending}
            accessibilityRole="radio"
            accessibilityLabel={t.detail.rate.star(n)}
            accessibilityState={{ checked: stars === n, disabled: sending }}
            hitSlop={4}
            style={styles.star}
          >
            <Ionicons
              name={n <= stars ? 'star' : 'star-outline'}
              size={34}
              color={n <= stars ? colors.amber : colors.textFaint}
            />
          </Pressable>
        ))}
      </View>
      <TextField
        label={t.detail.rate.comment}
        optionalLabel={t.common.optional}
        placeholder={t.detail.rate.commentPlaceholder}
        hint={t.detail.rate.commentHint(RATING_COMMENT_MAX)}
        value={comment}
        onChangeText={setComment}
        maxLength={RATING_COMMENT_MAX}
        multiline
        editable={!sending}
      />
      {failed ? <Notice text={t.detail.rate.error} tone="danger" /> : null}
      <Button
        testID="send-rating"
        title={t.detail.rate.send}
        icon="send"
        variant="dark"
        loading={sending}
        disabled={stars === 0}
        onPress={() => void send()}
      />
    </Card>
  );
}

const useStyles = makeStyles(() => ({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: space.xs },
  star: { minWidth: TOUCH, minHeight: TOUCH, alignItems: 'center', justifyContent: 'center' },
}));

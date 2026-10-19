import {
  type BookingErrors,
  type BookingInput,
  ELSEWHERE,
  type TripDestination,
  type TripPlan,
  rupeeRange,
  rupees,
  searchDestinations,
} from '@drivebuddy/shared';
import Ionicons from '@expo/vector-icons/Ionicons';
import { type ReactNode, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Chip } from '@/components/Chip';
import { TextField } from '@/components/TextField';
import { useConfig } from '@/config/ConfigProvider';
import { type Messages, useI18n } from '@/i18n';
import { errorText, kmText, tripDays } from '@/i18n/format';
import { TOUCH, makeStyles, radius, space, useTheme } from '@/theme';

/** The destination's name in the customer's language. */
export const placeName = (t: Messages, d: TripDestination) =>
  t.locale === 'hi-IN' && d.nameHi ? d.nameHi : d.name;

/**
 * For an outstation trip or one-way drop: where to, how many days, and the
 * estimate — worked out on the phone from the table the website publishes.
 */
export function TripSection({
  values,
  plan,
  errors,
  showErrors,
  onChange,
  onUseLocal,
}: {
  values: BookingInput;
  plan: TripPlan;
  errors: BookingErrors;
  /** Show field errors (after a submit attempt or once touched). */
  showErrors: (field: 'destId' | 'destOther' | 'days') => boolean;
  onChange: (patch: Partial<Pick<BookingInput, 'destId' | 'destOther' | 'days'>>) => void;
  onUseLocal: () => void;
}) {
  const { t } = useI18n();
  const { config } = useConfig();
  const { colors } = useTheme();
  const styles = useStyles();
  const [search, setSearch] = useState('');

  const found = useMemo(() => searchDestinations(config.destinations, search), [config.destinations, search]);
  const selected = values.destId && values.destId !== ELSEWHERE ? plan.dest : undefined;
  // The chosen place stays visible even when it is not among the matches.
  const shown = selected && !found.some((d) => d.id === selected.id) ? [selected, ...found] : found;
  const round = plan.kind === 'round';
  const error = (field: 'destId' | 'destOther' | 'days') => {
    const code = errors[field];
    return code && showErrors(field) ? errorText(t, field, code) : undefined;
  };

  const setDays = (n: number) => onChange({ days: String(Math.min(60, Math.max(plan.minDays, n))) });

  return (
    <View style={styles.box} testID="trip-section">
      <AppText variant="small" weight="bold">
        {round ? t.trip.whereRound : t.trip.whereOneWay}
      </AppText>
      <TextField
        label={t.trip.search}
        value={search}
        onChangeText={setSearch}
        placeholder={t.trip.placePlaceholder}
        autoCorrect={false}
        maxLength={40}
        testID="trip-search"
      />
      <View style={styles.chips} accessibilityRole="radiogroup">
        {shown.slice(0, 16).map((d) => (
          <Chip
            key={d.id}
            label={placeName(t, d)}
            selected={values.destId === d.id}
            onPress={() => onChange({ destId: d.id })}
            testID={`dest-${d.id}`}
          />
        ))}
        <Chip
          label={t.trip.elsewhere}
          selected={values.destId === ELSEWHERE}
          onPress={() => onChange({ destId: ELSEWHERE, destOther: values.destOther || search.trim() })}
          testID="dest-other"
        />
      </View>
      {search.trim() && found.length === 0 ? (
        <AppText variant="small" color={colors.textMuted}>
          {t.trip.noMatch}
        </AppText>
      ) : null}
      {error('destId') ? (
        <AppText variant="small" color={colors.danger}>
          {error('destId')}
        </AppText>
      ) : null}

      {values.destId === ELSEWHERE ? (
        <TextField
          label={t.trip.place}
          placeholder={t.trip.placePlaceholder}
          value={values.destOther}
          onChangeText={(v) => onChange({ destOther: v })}
          error={error('destOther')}
          maxLength={60}
          autoCapitalize="words"
          testID="trip-place"
        />
      ) : null}

      <View style={styles.daysRow}>
        <View style={styles.flex}>
          <AppText variant="small" weight="bold">
            {round ? t.trip.daysRound : t.trip.daysOneWay}
          </AppText>
          <AppText variant="tiny" color={colors.textMuted}>
            {plan.km ? t.trip.daysHint(plan.minDays) : t.trip.daysHintUnknown}
          </AppText>
        </View>
        <View style={styles.stepper}>
          <StepButton
            icon="remove"
            label={t.trip.fewer}
            disabled={plan.days <= plan.minDays}
            onPress={() => setDays(plan.days - 1)}
            testID="days-minus"
          />
          <AppText variant="heading" weight="heavy" style={styles.dayCount} testID="days-value">
            {plan.days}
          </AppText>
          <StepButton
            icon="add"
            label={t.trip.more}
            disabled={plan.days >= 60}
            onPress={() => setDays(plan.days + 1)}
            testID="days-plus"
          />
        </View>
      </View>
      {error('days') ? (
        <AppText variant="small" color={colors.danger}>
          {error('days')}
        </AppText>
      ) : null}

      <Estimate values={values} plan={plan} onUseLocal={onUseLocal} />
    </View>
  );
}

function Estimate({
  values,
  plan,
  onUseLocal,
}: {
  values: BookingInput;
  plan: TripPlan;
  onUseLocal: () => void;
}) {
  const { t } = useI18n();
  const { config } = useConfig();
  const { colors } = useTheme();
  const styles = useStyles();
  const oneWay = plan.kind === 'one-way';
  const rate = rupeeRange(config.prices.outstation);

  let body: ReactNode;
  if (!values.city) {
    body = <AppText color={colors.textMuted}>{t.trip.chooseCity}</AppText>;
  } else if (values.destId === ELSEWHERE) {
    body = (
      <AppText color={colors.textMuted}>
        {t.trip.elsewhereNote(rate)}
        {oneWay
          ? ` ${t.trip.elsewhereReturn(rupees(config.outstation.returnHour), rupees(config.outstation.returnMaxPerDay))}`
          : ''}
      </AppText>
    );
  } else if (!plan.dest) {
    body = <AppText color={colors.textMuted}>{t.trip.chooseDest}</AppText>;
  } else if (plan.sameCity) {
    body = (
      <>
        <AppText color={colors.textMuted}>{t.trip.sameCity}</AppText>
        <LocalLink onPress={onUseLocal} />
      </>
    );
  } else if (plan.est) {
    const from = t.cities[values.city];
    body = (
      <>
        <AppText variant="tiny" weight="bold" color={colors.textMuted}>
          {t.trip.estimateTitle.toUpperCase()}
        </AppText>
        <AppText variant="display" weight="heavy" testID="trip-estimate">
          {rupeeRange(plan.est)}
        </AppText>
        <AppText variant="small" color={colors.textMuted}>
          {t.trip.route(from, placeName(t, plan.dest), kmText(t, plan.km))} · {tripDays(t, plan)}
        </AppText>
        <View style={styles.lines}>
          <Line label={t.trip.times(drivingLabel(t, plan), rate)} amount={rupeeRange(plan.est.driving)} />
          {oneWay && plan.returnHours > 0 ? (
            <Line
              label={`${t.trip.homeLate(plan.returnHours)} (${t.trip.returnMax(
                rupees(config.outstation.returnHour),
                rupees(config.outstation.returnMaxPerDay),
              )})`}
              amount={rupees(plan.est.returnCharge)}
            />
          ) : oneWay ? (
            <Line label={t.trip.homeInTime} amount={t.trip.noCharge} />
          ) : null}
        </View>
        {plan.local ? (
          <View style={styles.tip}>
            <AppText variant="small">
              {t.trip.localTip(
                placeName(t, plan.dest),
                kmText(t, plan.km),
                rupeeRange(config.prices.fullDay),
              )}
            </AppText>
            <LocalLink onPress={onUseLocal} />
          </View>
        ) : null}
      </>
    );
  }

  return (
    <View style={styles.estimate} accessibilityLiveRegion="polite">
      {body}
      <AppText variant="tiny" color={colors.textMuted}>
        {t.trip.smallPrint(
          config.outstation.hoursPerDay,
          rupees(config.outstation.extraHour),
          rupees(config.outstation.mealAllowance),
          oneWay,
        )}
      </AppText>
    </View>
  );
}

/** "2 days" — the first line of the breakdown. */
const drivingLabel = (t: Messages, plan: TripPlan) => t.trip.days(plan.days);

function Line({ label, amount }: { label: string; amount: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.line}>
      <AppText variant="small" color={colors.textMuted} style={styles.flex}>
        {label}
      </AppText>
      <AppText variant="small" weight="bold">
        {amount}
      </AppText>
    </View>
  );
}

function LocalLink({ onPress }: { onPress: () => void }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={8} testID="use-local">
      <AppText variant="small" weight="bold" color={colors.amberText}>
        {t.trip.useLocal} →
      </AppText>
    </Pressable>
  );
}

function StepButton({
  icon,
  label,
  disabled,
  onPress,
  testID,
}: {
  icon: 'add' | 'remove';
  label: string;
  disabled: boolean;
  onPress: () => void;
  testID: string;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.step,
        disabled ? styles.stepOff : null,
        pressed ? styles.stepPressed : null,
      ]}
      testID={testID}
    >
      <Ionicons name={icon} size={20} color={disabled ? colors.textFaint : colors.text} />
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  box: {
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.background,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  daysRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  step: {
    width: TOUCH,
    height: TOUCH,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepOff: { opacity: 0.5 },
  stepPressed: { backgroundColor: c.amberSoft },
  dayCount: { minWidth: 28, textAlign: 'center' },
  estimate: {
    gap: space.xs + 2,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
  },
  lines: {
    gap: space.xs,
    borderTopWidth: 1,
    borderTopColor: c.line,
    paddingTop: space.sm,
    marginTop: space.xs,
  },
  line: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  tip: { gap: space.xs, backgroundColor: c.cream, borderRadius: radius.sm, padding: space.sm },
}));

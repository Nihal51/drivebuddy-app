import {
  type BookingErrors,
  type BookingInput,
  ELSEWHERE,
  dayRateFor,
  daySpan,
  type TripDestination,
  type TripPlan,
  rupeeRange,
  rupees,
  searchDestinations,
} from '@drivebuddy/shared';
import Ionicons from '@expo/vector-icons/Ionicons';
import { type ReactNode, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Chip } from '@/components/Chip';
import { TextField } from '@/components/TextField';
import { useConfig } from '@/config/ConfigProvider';
import { type Messages, useI18n } from '@/i18n';
import { errorText, formatDateTime, kmText, tripDays } from '@/i18n/format';
import { TOUCH, makeStyles, radius, space, useTheme } from '@/theme';

import type { ReturnTrains } from './useReturnTrains';

/** ₹4.5 a km: rupees() rounds to whole rupees. */
const perKm = (n: number) => `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n)}`;

/** The destination's name in the customer's language. */
export const placeName = (t: Messages, d: TripDestination) =>
  t.locale === 'hi-IN' && d.nameHi ? d.nameHi : d.name;

/**
 * For an outstation trip or one-way drop: where to, how many days, and the
 * estimate — worked out on the phone from the table the website publishes,
 * for the time the driver leaves (`startAt`).
 */
export function TripSection({
  values,
  plan,
  rail,
  startAt,
  nonstop,
  onNonstop,
  errors,
  showErrors,
  onChange,
  onUseLocal,
}: {
  values: BookingInput;
  plan: TripPlan;
  /** One-way drops: the real trains home for that day (useReturnTrains). */
  rail: ReturnTrains;
  /** When the driver leaves (ms): the time picked, or soon for "as soon as possible". */
  startAt: number;
  /** One-way: drive day and night, without the night's rest. */
  nonstop: boolean;
  onNonstop: (on: boolean) => void;
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
      <TextField
        label={round ? t.trip.whereRound : t.trip.whereOneWay}
        value={search}
        onChangeText={setSearch}
        placeholder={t.trip.search}
        autoCorrect={false}
        maxLength={40}
        testID="trip-search"
      />
      <View style={styles.chips} accessibilityRole="radiogroup">
        {/* A few popular places until the customer searches: a short list reads at a glance. */}
        {shown.slice(0, search.trim() ? 12 : 8).map((d) => (
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

      {!round ? (
        <Pressable
          onPress={() => onNonstop(!nonstop)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: nonstop }}
          style={styles.toggle}
          testID="trip-nonstop"
        >
          <Ionicons
            name={nonstop ? 'checkbox' : 'square-outline'}
            size={22}
            color={nonstop ? colors.amberText : colors.textMuted}
          />
          <View style={styles.flex}>
            <AppText variant="small" weight="bold">
              {t.trip.nonstop}
            </AppText>
            <AppText variant="tiny" color={colors.textMuted}>
              {t.trip.nonstopHint}
            </AppText>
          </View>
        </Pressable>
      ) : null}

      <Estimate values={values} plan={plan} rail={rail} startAt={startAt} onUseLocal={onUseLocal} />
    </View>
  );
}

function Estimate({
  values,
  plan,
  rail,
  startAt,
  onUseLocal,
}: {
  values: BookingInput;
  plan: TripPlan;
  rail: ReturnTrains;
  startAt: number;
  onUseLocal: () => void;
}) {
  const { t } = useI18n();
  const { config } = useConfig();
  const { colors } = useTheme();
  const styles = useStyles();
  const oneWay = plan.kind === 'one-way';
  // This place's day price (nearer places cost less a day); a place not in the list: the whole span.
  const day = dayRateFor(config, plan.km);
  const rate = rupeeRange(day);

  let body: ReactNode;
  if (!values.city) {
    body = <AppText color={colors.textMuted}>{t.trip.chooseCity}</AppText>;
  } else if (values.destId === ELSEWHERE) {
    body = (
      <AppText color={colors.textMuted}>
        {t.trip.elsewhereNote(rupeeRange(daySpan(config)))}
        {oneWay
          ? ` ${t.trip.elsewhereReturn(rupees(config.outstation.returnHour), rupees(config.outstation.returnMaxPerDay), config.outstation.returnFullDayAfter ?? 24)}`
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
        {plan.est.route ? (
          // A longer drop: one price for the route; his way home and the waiting are in it.
          <View style={styles.lines}>
            <Line
              label={
                plan.est.route.by === 'km'
                  ? t.trip.routeByKm(
                      kmText(t, plan.est.route.km),
                      rupees(config.outstation.routeBase ?? 0),
                      perKm(config.outstation.routePerKm ?? 0),
                    )
                  : t.trip.routeByDays(
                      plan.est.route.awayHours,
                      plan.est.route.days,
                      rupees(config.outstation.routeMinBase ?? 0),
                      rupees(config.outstation.routeMinPerDay ?? 0),
                    )
              }
              amount={rupees(plan.est.route.price)}
            />
            <Line
              label={t.trip.routeWayHome(plan.returnHours, plan.est.route.awayHours)}
              amount={t.trip.included}
            />
            <Line
              label={t.trip.routeLate(
                config.outstation.lateAfterHours ?? 0,
                rupees(config.outstation.extraHour),
              )}
              amount=""
            />
          </View>
        ) : (
          <View style={styles.lines}>
            {!oneWay || plan.fullDays > 0 ? (
              <Line
                label={t.trip.times(
                  oneWay
                    ? t.trip.drivingDays(plan.fullDays, config.outstation.hoursPerDay)
                    : t.trip.days(plan.fullDays),
                  rate,
                )}
                amount={rupeeRange({ from: plan.fullDays * day.from, to: plan.fullDays * day.to })}
              />
            ) : null}
            {oneWay &&
            plan.extraHours > 0 &&
            plan.fullDays === 0 &&
            plan.extraHours * config.outstation.extraHour < (config.outstation.shortDriveMinimum ?? 0) ? (
              // A short drive: the minimum (₹600) rather than the hours.
              <Line
                label={t.trip.shortDriveMin(
                  plan.extraHours,
                  rupees(config.outstation.shortDriveMinimum ?? 0),
                )}
                amount={rupees(plan.est.extraCharge)}
              />
            ) : oneWay && plan.extraHours > 0 ? (
              <Line
                label={t.trip.times(
                  t.trip.drivingHours(plan.extraHours, plan.fullDays > 0),
                  rupees(config.outstation.extraHour),
                )}
                amount={rupees(plan.est.extraCharge)}
              />
            ) : null}
            {oneWay ? (
              plan.returnHours > 0 ? (
                <Line
                  label={`${t.trip.wayHomeHours(plan.returnHours)} (${t.trip.returnMax(
                    rupees(config.outstation.returnHour),
                    rupees(config.outstation.returnMaxPerDay),
                    config.outstation.returnFullDayAfter ?? 24,
                  )})`}
                  amount={rupees(plan.est.returnCharge)}
                />
              ) : (
                <Line label={t.trip.homeInTime} amount={t.trip.noCharge} />
              )
            ) : null}
          </View>
        )}
        {oneWay ? (
          <Timeline
            plan={plan}
            startAt={startAt}
            from={from}
            to={placeName(t, plan.dest)}
            byTrain={Boolean(rail.selected)}
          />
        ) : null}
        {oneWay && rail.status !== 'off' ? (
          <TrainsHome rail={rail} hasHubs={Boolean(plan.dest.rail?.hubs.length)} />
        ) : null}
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
        {plan?.est?.route
          ? t.trip.routeSmallPrint(rupees(config.outstation.mealAllowance))
          : t.trip.smallPrint(
              config.outstation.hoursPerDay,
              rupees(config.outstation.extraHour),
              rupees(config.outstation.mealAllowance),
              oneWay,
              config.outstation.extraFullDayAfter,
              config.outstation.returnFullDayAfter,
            )}
      </AppText>
    </View>
  );
}

/**
 * The one-way drop hour by hour: when he leaves, drops the car, catches his
 * train or bus, is home — and when the paid days end.
 */
function Timeline({
  plan,
  startAt,
  from,
  to,
  byTrain,
}: {
  plan: TripPlan;
  startAt: number;
  from: string;
  to: string;
  /** The way home is a real train from the lookup, not the typical time. */
  byTrain: boolean;
}) {
  const { t } = useI18n();
  const { config } = useConfig();
  const { colors } = useTheme();
  const styles = useStyles();
  if (plan.dropAt === undefined || plan.homeAt === undefined) return null;
  const at = (hours: number) => formatDateTime(t, startAt + Math.round((hours * 60) / 5) * 5 * 60_000);
  const leaveAt = plan.leaveAt ?? plan.dropAt;
  const h = (n: number) => Math.max(1, Math.round(n));
  const rows: { label: string; value: string }[] = [
    { label: t.trip.leaves(from), value: at(0) },
    {
      label: t.trip.driving,
      value: plan.nonstop
        ? t.trip.drivingNonstop(h(plan.driveHours))
        : plan.minDays > 1
          ? t.trip.drivingDaysRest(h(plan.driveHours), config.outstation.hoursPerDay)
          : t.trip.onBoard(h(plan.driveHours)),
    },
    { label: t.trip.drops(to), value: t.trip.about(at(plan.dropAt)) },
  ];
  rows.push({
    label: byTrain ? t.trip.wayHomeTrain : t.trip.wayHome,
    value: t.trip.onBoard(h(plan.homeAt - leaveAt)),
  });
  rows.push({ label: t.trip.homeIn(from), value: t.trip.about(at(plan.homeAt)) });
  return (
    <View style={styles.lines} testID="trip-timeline">
      <AppText variant="tiny" weight="bold" color={colors.textMuted}>
        {t.trip.timelineTitle.toUpperCase()}
      </AppText>
      {rows.map((r) => (
        <Line key={r.label} label={r.label} amount={r.value} />
      ))}
    </View>
  );
}

/**
 * The driver's train home for the drop (as the website): the routes the
 * lookup found for that day — scheduled or live times, never one passed off
 * as the other — to choose from, or plainly why none is shown. Nothing here
 * claims a seat or a ticket.
 */
function TrainsHome({ rail, hasHubs }: { rail: ReturnTrains; hasHubs: boolean }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useStyles();
  const hm = (min: number) => t.trip.hm(Math.floor(min / 60), min % 60);
  const clock = (ms: number) => formatDateTime(t, ms);
  let body: ReactNode;
  if (rail.status === 'loading') {
    body = (
      <View style={styles.toggle}>
        <ActivityIndicator size="small" color={colors.textMuted} />
        <AppText variant="small" color={colors.textMuted} style={styles.flex}>
          {rail.retrying ? t.trip.trainsRetrying : t.trip.trainsChecking}
        </AppText>
      </View>
    );
  } else if (rail.status === 'none' || rail.status === 'error') {
    body = (
      <View style={styles.trainProblem}>
        <AppText variant="small">
          {rail.status === 'none' ? t.trip.trainsNone(hasHubs) : t.trip.trainsError}
        </AppText>
      </View>
    );
  } else {
    body = (
      <View style={styles.trainList} accessibilityRole="radiogroup">
        {rail.options.map((o, i) => {
          const on = rail.selected?.id === o.id;
          return (
            <Pressable
              key={o.id}
              onPress={() => rail.select(o.id)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              style={[styles.trainOption, on ? styles.trainOptionOn : null]}
              testID={`train-${o.id}`}
            >
              <Ionicons
                name={on ? 'radio-button-on' : 'radio-button-off'}
                size={20}
                color={on ? colors.amberText : colors.textMuted}
              />
              <View style={styles.flex}>
                <AppText variant="small" weight="bold">
                  {i === 0 ? `${t.trip.trainRecommended}: ` : ''}
                  {o.legs.map((l) => `${l.train.number} ${l.train.name}`).join(' + ')}
                </AppText>
                {o.legs.map((l, j) => (
                  <AppText key={`${l.train.number}-${j}`} variant="tiny" color={colors.textMuted}>
                    {l.from.name} {clock(l.depart)} → {l.to.name} {clock(l.arrive)}
                  </AppText>
                ))}
                <AppText variant="tiny" color={colors.textMuted}>
                  {o.transfer
                    ? t.trip.trainChange(o.transfer.station.name, hm(o.transfer.minutes))
                    : t.trip.trainDirect}
                  {' · '}
                  {t.trip.trainWait(hm(o.waitMinutes))} · {t.trip.trainHome(clock(o.expectedArrive))}
                </AppText>
                {o.warnings.map((w) => (
                  <AppText key={w} variant="tiny" color={colors.danger}>
                    {w}
                  </AppText>
                ))}
              </View>
            </Pressable>
          );
        })}
        <AppText variant="tiny" color={colors.textMuted}>
          {t.trip.trainsSource(
            Boolean(rail.lookup?.live),
            rail.lookup?.checkedAt ? clock(rail.lookup.checkedAt) : '—',
          )}
        </AppText>
      </View>
    );
  }
  return (
    <View style={styles.lines} testID="trains-home">
      <AppText variant="tiny" weight="bold" color={colors.textMuted}>
        {t.trip.trainsTitle.toUpperCase()}
      </AppText>
      {body}
    </View>
  );
}

function Line({ label, amount }: { label: string; amount: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.line}>
      <AppText variant="small" color={colors.textMuted} style={styles.flex}>
        {label}
      </AppText>
      <AppText variant="small" weight="bold" style={styles.amount}>
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
  box: { gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  daysRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  step: {
    width: TOUCH,
    height: TOUCH,
    borderRadius: radius.pill,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepOff: { opacity: 0.5 },
  stepPressed: { backgroundColor: c.surfacePressed },
  dayCount: { minWidth: 28, textAlign: 'center' },
  estimate: {
    gap: space.xs + 2,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: c.cream,
  },
  lines: {
    gap: space.xs,
    borderTopWidth: 1,
    borderTopColor: c.creamLine,
    paddingTop: space.sm,
    marginTop: space.xs,
  },
  line: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  amount: { flexShrink: 1, textAlign: 'right', maxWidth: '58%' },
  toggle: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  tip: { gap: space.xs, backgroundColor: c.cream, borderRadius: radius.sm, padding: space.sm },
  trainList: { gap: space.sm },
  trainOption: {
    flexDirection: 'row',
    gap: space.sm,
    padding: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.creamLine,
    backgroundColor: c.background,
  },
  trainOptionOn: { borderColor: c.amber },
  trainProblem: { backgroundColor: c.dangerSoft, borderRadius: radius.sm, padding: space.sm },
}));

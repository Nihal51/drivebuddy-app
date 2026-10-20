import {
  type BookingErrors,
  type BookingField,
  type BookingInput,
  CITIES,
  EMPTY_BOOKING,
  type PackageId,
  isPackageId,
  isTripPackage,
  packagePrice,
  planTrip,
  preferredTimeValue,
  prettyPhone,
  rupeeRange,
  tripRecord,
  validateBooking,
} from '@drivebuddy/shared';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  type ScrollView,
  type TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { CATEGORIES, type Category, categoryOf, findCategory } from '@/booking/categories';
import { TripSection, placeName } from '@/booking/TripSection';
import { WhenPicker, type When } from '@/booking/WhenPicker';
import { whatsappBookingMessage } from '@/booking/whatsapp';
import { AppText } from '@/components/AppText';
import { Notice } from '@/components/bits';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { PackageRow } from '@/components/PackageRow';
import { Screen } from '@/components/Screen';
import { ServiceGrid, ServiceTile } from '@/components/ServiceTile';
import { TextField } from '@/components/TextField';
import { useConfig } from '@/config/ConfigProvider';
import { type SubmitFailure, submitBooking } from '@/data/bookings';
import { useI18n } from '@/i18n';
import { errorText, formatPreferred, priceLabel } from '@/i18n/format';
import { track } from '@/lib/analytics';
import { openWhatsapp } from '@/lib/links';
import { makeStyles, radius, space, useTheme } from '@/theme';

type Phase =
  | { kind: 'editing' }
  | { kind: 'submitting' }
  | { kind: 'failed'; reason: SubmitFailure }
  | { kind: 'done'; id: string; phone: string };

type Step = 1 | 2 | 3;

/** The fields each step asks for, in screen order — checked before moving on. */
const STEP_FIELDS: Record<Step, BookingField[]> = {
  1: ['packageId'],
  2: ['city', 'destId', 'destOther', 'days', 'pickup'],
  3: ['name', 'phone', 'notes'],
};

/** The preferred-time value the form stores, from the picker's state. */
function preferredFrom(when: When): string {
  return when.mode === 'schedule' && when.slot ? preferredTimeValue(when.day, when.slot) : '';
}

export default function BookScreen() {
  const { ready, user } = useAuth();
  const { colors } = useTheme();
  const styles = useStyles();
  const params = useLocalSearchParams<{ package?: string; category?: string }>();
  // Wait for a saved login (and its profile) so the form can start pre-filled.
  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.amber} size="large" />
      </View>
    );
  }
  return (
    <BookingWizard
      key={user?.uid ?? 'guest'}
      initialPackage={params.package}
      initialCategory={params.category}
    />
  );
}

/**
 * Booking in three short steps — what, where and when, who — so each screen
 * asks one thing. A service tapped on Home skips the first step.
 */
function BookingWizard({
  initialPackage,
  initialCategory,
}: {
  initialPackage?: string;
  initialCategory?: string;
}) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useStyles();
  const { config } = useConfig();
  const { user, profile } = useAuth();

  const startPackage = isPackageId(initialPackage) ? initialPackage : '';
  const [values, setValues] = useState<BookingInput>(() => ({
    ...EMPTY_BOOKING,
    packageId: startPackage,
    name: profile?.name ?? '',
    phone: profile?.phone ?? '',
  }));
  const [step, setStep] = useState<Step>(startPackage ? 2 : 1);
  const [category, setCategory] = useState<Category | undefined>(() =>
    startPackage ? categoryOf(startPackage) : findCategory(initialCategory),
  );
  const [when, setWhen] = useState<When>({ mode: 'asap' });
  const [touched, setTouched] = useState<Partial<Record<BookingField, boolean>>>({});
  // Steps whose errors are shown: the ones the customer tried to leave.
  const [checked, setChecked] = useState<Partial<Record<Step, boolean>>>({});
  const [phase, setPhase] = useState<Phase>({ kind: 'editing' });
  // "Now" for the time picker, fixed while the form is open so slots do not jump.
  const [now] = useState(() => Date.now());

  useEffect(() => {
    track('booking_form_opened', initialPackage ? { package: initialPackage } : {});
  }, [initialPackage]);

  const input: BookingInput = { ...values, preferredTime: preferredFrom(when) };
  const errors: BookingErrors = validateBooking(input);
  // Outstation trip / one-way drop: the plan behind the estimate, and the trip saved with the booking.
  const plan = isTripPackage(values.packageId)
    ? planTrip(config, values.packageId, values.city, values.destId, Number(values.days) || 0)
    : null;
  const trip = plan && values.destId ? tripRecord(plan, values.destOther) : null;
  const timeMissing = when.mode === 'schedule' && !when.slot;

  const stepOf = (field: BookingField): Step =>
    STEP_FIELDS[1].includes(field) ? 1 : STEP_FIELDS[2].includes(field) ? 2 : 3;
  const shown = (field: BookingField) => {
    const code = errors[field];
    return code && (checked[stepOf(field)] || touched[field]) ? errorText(t, field, code) : undefined;
  };
  const stepBlocked = (s: Step) => STEP_FIELDS[s].some((f) => errors[f]) || (s === 2 && timeMissing);

  const set = <K extends keyof BookingInput>(key: K, value: BookingInput[K]) =>
    setValues((v) => ({ ...v, [key]: value }));
  const touch = (field: BookingField) => setTouched((s) => ({ ...s, [field]: true }));

  /* Scroll to the top on a new step, and to the first problem when one blocks the way. */
  const scrollRef = useRef<ScrollView>(null);
  const positions = useRef<Partial<Record<BookingField, number>>>({});
  const record = (field: BookingField, y: number) => {
    positions.current[field] = y;
  };
  const phoneRef = useRef<TextInput>(null);

  const goTo = (next: Step) => {
    setStep(next);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  // The phone's back button steps back through the booking before leaving it.
  useEffect(() => {
    if (step === 1 || phase.kind === 'done') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setStep((s) => (s > 1 ? ((s - 1) as Step) : s));
      return true;
    });
    return () => sub.remove();
  }, [step, phase.kind]);

  const choosePackage = (id: PackageId) => {
    set('packageId', id);
    goTo(2);
  };
  const chooseCategory = (c: Category) => {
    setCategory(c);
    if (c.packages.length === 1) choosePackage(c.packages[0]);
  };

  function next() {
    setChecked((c) => ({ ...c, [step]: true }));
    if (stepBlocked(step)) {
      const first = STEP_FIELDS[step].find((f) => errors[f]) ?? (timeMissing ? 'preferredTime' : undefined);
      const y = first ? positions.current[first] : undefined;
      if (y !== undefined) scrollRef.current?.scrollTo({ y: Math.max(0, y - space.lg), animated: true });
      return;
    }
    if (step < 3) goTo((step + 1) as Step);
    else void submit();
  }

  async function submit() {
    setPhase({ kind: 'submitting' });
    const result = await submitBooking(input, user?.uid ?? null, {
      pingUrl: config.alerts.pingUrl,
      trip,
      tripsLive: config.tripsLive,
    });
    if (result.ok) {
      track('booking_submitted', {
        package: input.packageId,
        city: input.city,
        when: input.preferredTime ? 'scheduled' : 'asap',
        loggedIn: Boolean(user),
      });
    } else {
      track('booking_failed', { reason: result.reason });
    }
    setPhase(
      result.ok
        ? { kind: 'done', id: result.id, phone: prettyPhone(input.phone) }
        : { kind: 'failed', reason: result.reason },
    );
  }

  if (phase.kind === 'done') {
    return (
      <Success
        phone={phase.phone}
        onTrack={
          user ? () => router.replace({ pathname: '/booking/[id]', params: { id: phase.id } }) : undefined
        }
        onAnother={() => {
          setPhase({ kind: 'editing' });
          setValues((v) => ({ ...EMPTY_BOOKING, name: v.name, phone: v.phone, city: v.city }));
          setWhen({ mode: 'asap' });
          setChecked({});
          setTouched({});
          setCategory(undefined);
          goTo(1);
        }}
      />
    );
  }

  const submitting = phase.kind === 'submitting';
  const price = isPackageId(values.packageId)
    ? plan?.est
      ? rupeeRange(plan.est)
      : priceLabel(t, packagePrice(config, values.packageId))
    : '';

  return (
    <Screen
      edges={['bottom']}
      scrollRef={scrollRef}
      footer={
        step === 1 ? null : (
          <View style={styles.footer}>
            {phase.kind === 'failed' ? (
              // Right above the button they just pressed, with the way out: WhatsApp.
              <View style={styles.failure} accessibilityLiveRegion="assertive">
                <AppText variant="small" weight="heavy" color={colors.danger}>
                  {t.failure.title}
                </AppText>
                <AppText variant="small">{t.failure[phase.reason]}</AppText>
                <Button
                  title={t.failure.sendWhatsapp}
                  icon="logo-whatsapp"
                  variant="whatsapp"
                  compact
                  onPress={() => {
                    track('whatsapp_fallback_used');
                    void openWhatsapp(
                      config.contact.whatsapp,
                      whatsappBookingMessage(t, input, trip, config.destinations),
                    );
                  }}
                  testID="failure-whatsapp"
                />
              </View>
            ) : null}
            {checked[step] && stepBlocked(step) ? (
              <AppText variant="small" color={colors.danger} align="center">
                {t.book.fixErrors}
              </AppText>
            ) : null}
            <View style={styles.footerRow}>
              <Button
                title={t.wizard.back}
                icon="chevron-back"
                variant="outline"
                onPress={() => goTo((step - 1) as Step)}
                style={styles.backButton}
                testID="step-back"
              />
              {step === 3 ? (
                <Button
                  title={submitting ? t.book.submitting : t.book.submit}
                  icon="checkmark-circle"
                  loading={submitting}
                  onPress={next}
                  style={styles.flex}
                  testID="submit-booking"
                />
              ) : (
                <Button title={t.wizard.continue} onPress={next} style={styles.flex} testID="next-step" />
              )}
            </View>
            {step === 3 ? (
              <AppText variant="tiny" color={colors.textMuted} align="center">
                {t.book.disclaimer}
              </AppText>
            ) : null}
          </View>
        )
      }
    >
      <Progress step={step} />

      {step === 1 ? (
        <>
          <AppText variant="title" weight="heavy" accessibilityRole="header">
            {category && category.packages.length > 1
              ? t.categories[category.id].name
              : t.wizard.serviceTitle}
          </AppText>
          {category && category.packages.length > 1 ? (
            <>
              <AppText color={colors.textMuted}>{t.wizard.optionsTitle}</AppText>
              <View style={styles.options} accessibilityRole="radiogroup">
                {category.packages.map((id) => (
                  <PackageRow
                    key={id}
                    id={id}
                    mode="choice"
                    selected={values.packageId === id}
                    onPress={() => choosePackage(id)}
                  />
                ))}
              </View>
              <Button
                title={t.wizard.allServices}
                icon="grid-outline"
                variant="ghost"
                onPress={() => setCategory(undefined)}
                testID="all-services"
              />
            </>
          ) : (
            <ServiceGrid>
              {CATEGORIES.map((c) => (
                <ServiceTile key={c.id} category={c} onPress={() => chooseCategory(c)} />
              ))}
            </ServiceGrid>
          )}
          {shown('packageId') ? (
            <AppText variant="small" color={colors.danger}>
              {shown('packageId')}
            </AppText>
          ) : null}
        </>
      ) : null}

      {step === 2 ? (
        <>
          <ServiceSummary
            packageId={values.packageId}
            price={price}
            onChange={() => {
              setCategory(categoryOf(values.packageId));
              goTo(1);
            }}
          />
          <AppText variant="title" weight="heavy" accessibilityRole="header">
            {t.wizard.whereTitle}
          </AppText>

          <View style={styles.block} onLayout={(e) => record('city', e.nativeEvent.layout.y)}>
            <AppText variant="small" weight="bold">
              {t.book.city}
            </AppText>
            <View style={styles.chips} accessibilityRole="radiogroup">
              {CITIES.map((c) => (
                <Chip
                  key={c}
                  label={t.cities[c]}
                  selected={values.city === c}
                  onPress={() => set('city', c)}
                  testID={`city-${c}`}
                />
              ))}
            </View>
            {shown('city') ? (
              <AppText variant="small" color={colors.danger}>
                {shown('city')}
              </AppText>
            ) : null}
          </View>

          {plan ? (
            <View
              onLayout={(e) => {
                for (const f of ['destId', 'destOther', 'days'] as const) record(f, e.nativeEvent.layout.y);
              }}
            >
              <TripSection
                values={values}
                plan={plan}
                errors={errors}
                showErrors={(field) => Boolean(checked[2] || touched[field])}
                onChange={(patch) => {
                  setValues((v) => ({ ...v, ...patch }));
                  for (const key of Object.keys(patch)) touch(key as BookingField);
                }}
                onUseLocal={() => set('packageId', 'local-full-day')}
              />
            </View>
          ) : null}

          <View onLayout={(e) => record('pickup', e.nativeEvent.layout.y)}>
            <TextField
              label={t.book.pickup}
              placeholder={t.book.pickupPlaceholder}
              value={values.pickup}
              onChangeText={(v) => set('pickup', v)}
              onBlur={() => touch('pickup')}
              error={shown('pickup')}
              multiline
              autoComplete="street-address"
              textContentType="fullStreetAddress"
              maxLength={300}
              testID="field-pickup"
            />
          </View>

          <View onLayout={(e) => record('preferredTime', e.nativeEvent.layout.y)}>
            <WhenPicker
              value={when}
              onChange={setWhen}
              now={now}
              error={checked[2] && timeMissing ? t.errors.preferredTime.required : undefined}
            />
          </View>
        </>
      ) : null}

      {step === 3 ? (
        <>
          <AppText variant="title" weight="heavy" accessibilityRole="header">
            {t.wizard.confirmTitle}
          </AppText>

          <View style={styles.summary} testID="booking-summary">
            <SummaryRow
              icon="car-outline"
              label={t.wizard.service}
              value={isPackageId(values.packageId) ? t.packages[values.packageId].name : ''}
              onChange={() => {
                setCategory(categoryOf(values.packageId));
                goTo(1);
              }}
            />
            {trip && plan?.dest ? (
              <SummaryRow
                icon="map-outline"
                label={t.detail.trip}
                value={`${t.cities[values.city as keyof typeof t.cities] ?? values.city} → ${placeName(t, plan.dest)} · ${t.trip.days(plan.days)}`}
                onChange={() => goTo(2)}
              />
            ) : null}
            <SummaryRow
              icon="location-outline"
              label={t.book.pickup}
              value={`${values.pickup.trim()}${values.city ? `, ${t.cities[values.city as keyof typeof t.cities] ?? values.city}` : ''}`}
              onChange={() => goTo(2)}
            />
            <SummaryRow
              icon="time-outline"
              label={t.book.when}
              value={formatPreferred(t, input.preferredTime)}
              onChange={() => goTo(2)}
            />
            <View style={styles.priceRow}>
              <AppText color={colors.textMuted}>{plan?.est ? t.wizard.estimate : t.wizard.price}</AppText>
              <AppText variant="heading" weight="heavy">
                {price}
              </AppText>
            </View>
          </View>

          <AppText variant="heading" weight="heavy">
            {t.wizard.yourDetails}
          </AppText>
          {user ? <Notice text={t.book.loggedInAs(profile?.name || user.email || '')} tone="grey" /> : null}

          <View onLayout={(e) => record('name', e.nativeEvent.layout.y)}>
            <TextField
              label={t.book.name}
              placeholder={t.book.namePlaceholder}
              value={values.name}
              onChangeText={(v) => set('name', v)}
              onBlur={() => touch('name')}
              error={shown('name')}
              autoComplete="name"
              textContentType="name"
              autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={() => phoneRef.current?.focus()}
              maxLength={60}
              testID="field-name"
            />
          </View>

          <View onLayout={(e) => record('phone', e.nativeEvent.layout.y)}>
            <TextField
              ref={phoneRef}
              label={t.book.phone}
              placeholder={t.book.phonePlaceholder}
              prefix="+91"
              value={values.phone}
              onChangeText={(v) => set('phone', v)}
              onBlur={() => touch('phone')}
              error={shown('phone')}
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              maxLength={16}
              testID="field-phone"
            />
          </View>

          <View onLayout={(e) => record('notes', e.nativeEvent.layout.y)}>
            <TextField
              label={t.book.notes}
              optionalLabel={t.common.optional}
              placeholder={t.book.notesPlaceholder}
              value={values.notes}
              onChangeText={(v) => set('notes', v)}
              onBlur={() => touch('notes')}
              error={shown('notes')}
              multiline
              maxLength={500}
            />
          </View>

          {!user ? (
            <Pressable onPress={() => router.push('/account')} accessibilityRole="link" hitSlop={8}>
              <AppText variant="small" color={colors.textMuted}>
                {t.book.loginHint}{' '}
                <AppText variant="small" weight="bold" color={colors.amberText}>
                  {t.book.loginLink} →
                </AppText>
              </AppText>
            </Pressable>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

/** "Step 2 of 3 · Pickup and time" over three bars. */
function Progress({ step }: { step: Step }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View
      style={styles.progress}
      accessibilityRole="progressbar"
      accessibilityLabel={`${t.wizard.step(step, 3)}: ${t.wizard.steps[step - 1]}`}
      accessibilityValue={{ min: 1, max: 3, now: step }}
      testID="booking-progress"
    >
      <View style={styles.bars}>
        {[1, 2, 3].map((n) => (
          <View key={n} style={[styles.bar, n <= step ? styles.barOn : null]} />
        ))}
      </View>
      <AppText variant="tiny" weight="bold" color={colors.textMuted}>
        {t.wizard.step(step, 3)} · {t.wizard.steps[step - 1]}
      </AppText>
    </View>
  );
}

/** The chosen service at the top of step 2, with a way back to change it. */
function ServiceSummary({
  packageId,
  price,
  onChange,
}: {
  packageId: BookingInput['packageId'];
  price: string;
  onChange: () => void;
}) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useStyles();
  if (!isPackageId(packageId)) return null;
  const c = categoryOf(packageId);
  return (
    <View style={styles.chosen}>
      <View style={styles.chosenIcon}>
        <Ionicons name={c?.icon ?? 'car'} size={20} color={colors.amberText} />
      </View>
      <View style={styles.flex}>
        <AppText weight="heavy">{t.packages[packageId].name}</AppText>
        <AppText variant="small" color={colors.textMuted}>
          {price}
        </AppText>
      </View>
      <Pressable onPress={onChange} accessibilityRole="button" hitSlop={10} testID="change-service">
        <AppText variant="small" weight="bold" color={colors.amberText}>
          {t.wizard.change}
        </AppText>
      </Pressable>
    </View>
  );
}

function SummaryRow({
  icon,
  label,
  value,
  onChange,
}: {
  icon: 'car-outline' | 'map-outline' | 'location-outline' | 'time-outline';
  label: string;
  value: string;
  onChange: () => void;
}) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.summaryRow}>
      <Ionicons name={icon} size={18} color={colors.textMuted} style={styles.summaryIcon} />
      <View style={styles.flex}>
        <AppText variant="tiny" weight="bold" color={colors.textMuted}>
          {label}
        </AppText>
        <AppText>{value}</AppText>
      </View>
      <Pressable
        onPress={onChange}
        accessibilityRole="button"
        accessibilityLabel={`${t.wizard.change}: ${label}`}
        hitSlop={10}
      >
        <AppText variant="small" weight="bold" color={colors.amberText}>
          {t.wizard.change}
        </AppText>
      </Pressable>
    </View>
  );
}

function Success({
  phone,
  onTrack,
  onAnother,
}: {
  phone: string;
  onTrack?: () => void;
  onAnother: () => void;
}) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Screen edges={['bottom']} contentStyle={styles.successPage}>
      <View style={styles.successIcon}>
        <Ionicons name="checkmark" size={44} color={colors.white} />
      </View>
      <AppText
        variant="display"
        weight="heavy"
        align="center"
        accessibilityRole="header"
        accessibilityLiveRegion="polite"
      >
        {t.success.title}
      </AppText>
      <AppText align="center" color={colors.textMuted}>
        {t.success.body(phone)}
      </AppText>
      <View style={styles.successActions}>
        {onTrack ? (
          <Button title={t.success.track} icon="navigate" onPress={onTrack} testID="track-booking" />
        ) : (
          <Notice text={t.success.guestTip} />
        )}
        <Button title={t.success.another} variant="outline" icon="add-circle" onPress={onAnother} />
        <Button title={t.success.home} variant="ghost" onPress={() => router.dismissTo('/')} />
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  footer: { width: '100%', maxWidth: 640, gap: space.sm },
  footerRow: { flexDirection: 'row', gap: space.sm },
  backButton: { paddingHorizontal: space.md },
  block: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  options: { gap: space.sm },
  progress: { gap: space.sm },
  bars: { flexDirection: 'row', gap: 6 },
  bar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: c.surface },
  barOn: { backgroundColor: c.amber },
  chosen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: c.surface,
  },
  chosenIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summary: { gap: space.lg, padding: space.lg, borderRadius: radius.lg, backgroundColor: c.surface },
  summaryRow: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  summaryIcon: { marginTop: 2 },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: c.line,
    paddingTop: space.md,
  },
  failure: {
    gap: space.xs + 2,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: c.dangerSoft,
  },
  successPage: { justifyContent: 'center', flexGrow: 1 },
  successIcon: {
    width: 84,
    height: 84,
    borderRadius: radius.pill,
    backgroundColor: c.successSolid,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  successActions: { gap: space.sm, marginTop: space.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background },
}));

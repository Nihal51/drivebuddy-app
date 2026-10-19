import {
  BOOKING_FIELDS,
  type BookingErrors,
  type BookingField,
  type BookingInput,
  CITIES,
  EMPTY_BOOKING,
  PACKAGE_GROUPS,
  hasErrors,
  isPackageId,
  isTripPackage,
  planTrip,
  preferredTimeValue,
  prettyPhone,
  tripRecord,
  validateBooking,
} from '@drivebuddy/shared';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, type ScrollView, type TextInput, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { TripSection } from '@/booking/TripSection';
import { WhenPicker, type When } from '@/booking/WhenPicker';
import { whatsappBookingMessage } from '@/booking/whatsapp';
import { AppText } from '@/components/AppText';
import { Notice } from '@/components/bits';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { PackageRow } from '@/components/PackageRow';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { useConfig } from '@/config/ConfigProvider';
import { type SubmitFailure, submitBooking } from '@/data/bookings';
import { useI18n } from '@/i18n';
import { errorText } from '@/i18n/format';
import { track } from '@/lib/analytics';
import { openWhatsapp } from '@/lib/links';
import { makeStyles, radius, space, useTheme } from '@/theme';

type Phase =
  | { kind: 'editing' }
  | { kind: 'submitting' }
  | { kind: 'failed'; reason: SubmitFailure }
  | { kind: 'done'; id: string; phone: string };

/** The preferred-time value the form stores, from the picker's state. */
function preferredFrom(when: When): string {
  return when.mode === 'schedule' && when.slot ? preferredTimeValue(when.day, when.slot) : '';
}

export default function BookScreen() {
  const { ready, user } = useAuth();
  const { colors } = useTheme();
  const styles = useStyles();
  const params = useLocalSearchParams<{ package?: string }>();
  // Wait for a saved login (and its profile) so the form can start pre-filled.
  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.amber} size="large" />
      </View>
    );
  }
  return <BookingForm key={user?.uid ?? 'guest'} initialPackage={params.package} />;
}

function BookingForm({ initialPackage }: { initialPackage?: string }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useStyles();
  const { config } = useConfig();
  const { user, profile } = useAuth();

  const [values, setValues] = useState<BookingInput>(() => ({
    ...EMPTY_BOOKING,
    packageId: isPackageId(initialPackage) ? initialPackage : '',
    name: profile?.name ?? '',
    phone: profile?.phone ?? '',
  }));
  const [when, setWhen] = useState<When>({ mode: 'asap' });
  const [touched, setTouched] = useState<Partial<Record<BookingField, boolean>>>({});
  const [showAll, setShowAll] = useState(false);
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

  const shown = (field: BookingField) => {
    const code = errors[field];
    return code && (showAll || touched[field]) ? errorText(t, field, code) : undefined;
  };

  const set = <K extends keyof BookingInput>(key: K, value: BookingInput[K]) =>
    setValues((v) => ({ ...v, [key]: value }));
  const touch = (field: BookingField) => setTouched((s) => ({ ...s, [field]: true }));

  /* Scroll to the first problem on submit. */
  const scrollRef = useRef<ScrollView>(null);
  const positions = useRef<Partial<Record<BookingField, number>>>({});
  const record = (field: BookingField, y: number) => {
    positions.current[field] = y;
  };
  const phoneRef = useRef<TextInput>(null);
  const pickupRef = useRef<TextInput>(null);

  async function submit() {
    setShowAll(true);
    const first = BOOKING_FIELDS.find((f) => errors[f]) ?? (timeMissing ? 'preferredTime' : undefined);
    if (hasErrors(errors) || timeMissing) {
      const y = first ? positions.current[first] : undefined;
      if (y !== undefined) scrollRef.current?.scrollTo({ y: Math.max(0, y - space.lg), animated: true });
      return;
    }
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
          setShowAll(false);
          setTouched({});
        }}
      />
    );
  }

  const submitting = phase.kind === 'submitting';

  return (
    <Screen
      edges={['bottom']}
      scrollRef={scrollRef}
      footer={
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
          {showAll && (hasErrors(errors) || timeMissing) ? (
            <AppText variant="small" color={colors.danger} align="center">
              {t.book.fixErrors}
            </AppText>
          ) : null}
          <Button
            title={submitting ? t.book.submitting : t.book.submit}
            icon="checkmark-circle"
            loading={submitting}
            onPress={() => void submit()}
            testID="submit-booking"
          />
          <AppText variant="tiny" color={colors.textMuted} align="center">
            {t.book.disclaimer}
          </AppText>
        </View>
      }
    >
      <AppText color={colors.textMuted}>{t.book.lede}</AppText>

      {user ? (
        <Notice text={t.book.loggedInAs(profile?.name || user.email || '')} tone="grey" />
      ) : (
        <Card tone="cream" style={styles.loginCard}>
          <AppText variant="small">{t.book.loginHint}</AppText>
          <Button title={t.book.loginLink} variant="ghost" compact onPress={() => router.push('/account')} />
        </Card>
      )}

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

      <View style={styles.block} onLayout={(e) => record('packageId', e.nativeEvent.layout.y)}>
        <AppText variant="small" weight="bold">
          {t.book.service}
        </AppText>
        {PACKAGE_GROUPS.flatMap((g) => g.packages).map((id) => (
          <PackageRow
            key={id}
            id={id}
            mode="choice"
            selected={values.packageId === id}
            onPress={() => set('packageId', id)}
          />
        ))}
        {shown('packageId') ? (
          <AppText variant="small" color={colors.danger}>
            {shown('packageId')}
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
            showErrors={(field) => showAll || Boolean(touched[field])}
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
          ref={pickupRef}
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
          error={showAll && timeMissing ? t.errors.preferredTime.required : undefined}
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
    </Screen>
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
  footer: { width: '100%', maxWidth: 640, gap: space.sm },
  block: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  loginCard: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md },
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

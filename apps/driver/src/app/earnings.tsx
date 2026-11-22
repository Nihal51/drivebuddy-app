/**
 * My earnings: the jobs he took from offers — what DriveBuddy owes him and has
 * paid, less the cash customers paid him (DriveBuddy's money) — the UPI ID his
 * weekly pay goes to, and his rating and strikes. Holding more cash than the
 * website's cash limit stops new offers: the warning says how much to settle.
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import { DEFAULT_CASH_LIMIT, rupees } from '@drivebuddy/shared';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useDriverAuth } from '@/auth/DriverAuth';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { loadCashLimit } from '@/data/cashLimit';
import { type MyRecord, cleanUpi, isUpi, saveUpi, watchMyRecord } from '@/data/me';
import { type Offer, cashOwed, earningsOf, overCashLimit, watchMyOffers } from '@/data/offers';
import { useI18n } from '@/i18n';
import { formatDateTime, formatPreferred, packageName } from '@/i18n/format';
import { makeStyles, space, useTheme } from '@/theme';

export default function EarningsScreen() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useStyles();
  const { state } = useDriverAuth();
  const phone = state.status === 'in' ? state.driver.phone : '';
  const driverId = state.status === 'in' ? state.driver.driverId : '';
  const [offers, setOffers] = useState<Offer[] | null>(null);
  // null: no record (the review login) or not readable — then there is nothing to save a UPI ID to.
  const [me, setMe] = useState<MyRecord | null>(null);
  const [cashLimit, setCashLimit] = useState(DEFAULT_CASH_LIMIT);

  useEffect(() => (phone ? watchMyOffers(phone, (list) => setOffers(list ?? [])) : undefined), [phone]);
  useEffect(() => (driverId ? watchMyRecord(driverId, setMe) : undefined), [driverId]);
  useEffect(() => loadCashLimit(setCashLimit), []);

  if (offers === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.amber} />
      </View>
    );
  }
  const e = earningsOf(offers);
  const owe = cashOwed(e);

  return (
    <Screen edges={['bottom']}>
      {overCashLimit(e, cashLimit) ? (
        <Card tone="cream" style={{ borderWidth: 2, borderColor: colors.danger }}>
          <View style={styles.row}>
            <Ionicons name="warning" size={22} color={colors.danger} />
            <AppText weight="heavy" color={colors.danger} style={{ flex: 1 }} testID="cash-limit">
              {t.earnings.overLimit(rupees(owe))}
            </AppText>
          </View>
          <AppText variant="small">{t.earnings.overLimitNote(rupees(cashLimit))}</AppText>
        </Card>
      ) : null}

      <Card tone="cream">
        <AppText variant="small" color={colors.textMuted}>
          {owe > 0 ? t.earnings.youOwe : t.earnings.owed}
        </AppText>
        <AppText variant="display" weight="heavy" color={owe > 0 ? colors.danger : undefined}>
          {rupees(owe > 0 ? owe : e.net)}
        </AppText>
        {e.cashKept > 0 ? (
          <AppText variant="small" weight="bold" testID="earnings-sum">
            {owe > 0
              ? t.earnings.sumOwe(rupees(e.owed), rupees(e.cashKept), rupees(owe))
              : t.earnings.sumPays(rupees(e.owed), rupees(e.cashKept), rupees(e.net))}
          </AppText>
        ) : null}
        <View style={styles.row}>
          <AppText variant="small" color={colors.textMuted}>
            {t.earnings.upcoming}: {rupees(e.upcoming)}
          </AppText>
          <AppText variant="small" color={colors.textMuted}>
            {t.earnings.paid}: {rupees(e.paid)}
          </AppText>
        </View>
        <AppText variant="tiny" color={colors.textFaint}>
          {t.earnings.note}
        </AppText>
      </Card>

      {me ? <UpiCard driverId={driverId} saved={me.upi} /> : null}
      {me ? <RatingCard me={me} /> : null}

      {e.list.length === 0 ? <AppText color={colors.textMuted}>{t.earnings.empty}</AppText> : null}

      {e.list.map((o) => (
        <Card key={o.id}>
          <View style={styles.row}>
            <AppText weight="bold" style={{ flex: 1 }}>
              {packageName(t, o.packageId)}
              {o.ref ? ` · ${o.ref}` : ''}
            </AppText>
            <AppText weight="heavy">{rupees(o.driverPay)}</AppText>
          </View>
          <AppText variant="small" color={colors.textMuted}>
            {formatPreferred(t, o.when)} · {o.area}
          </AppText>
          {o.cashCollected > 0 ? (
            <AppText variant="small" weight="bold" color={colors.amberText}>
              {t.earnings.cashKept(rupees(o.cashCollected))}
            </AppText>
          ) : null}
          <AppText
            variant="small"
            weight="bold"
            color={o.paid ? colors.success : o.done ? colors.amberText : colors.textFaint}
          >
            {o.paid
              ? t.earnings.statusPaid(o.paidAt ? formatDateTime(t, o.paidAt) : '')
              : o.done
                ? t.earnings.statusOwed
                : t.earnings.statusUpcoming}
          </AppText>
        </Card>
      ))}
    </Screen>
  );
}

/** His UPI ID: the saved one with Change, or the field to type it. */
function UpiCard({ driverId, saved }: { driverId: string; saved: string }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useStyles();
  const [editing, setEditing] = useState(!saved);
  const [typed, setTyped] = useState(saved);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const upi = cleanUpi(typed);
    // Checked here first so the words are right away, not after a refused write.
    if (!isUpi(upi)) {
      setError(t.earnings.upiInvalid);
      return;
    }
    setBusy(true);
    setError(null);
    const res = await saveUpi(driverId, upi);
    setBusy(false);
    if (res.ok) {
      setTyped(upi);
      setEditing(false);
      setNote(t.earnings.upiSaved);
      return;
    }
    setError(
      res.reason === 'invalid'
        ? t.earnings.upiInvalid
        : res.reason === 'refused'
          ? t.earnings.upiRefused
          : t.earnings.upiFailed,
    );
  };

  if (!editing) {
    return (
      <Card>
        <View style={styles.row}>
          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          <AppText weight="bold" style={{ flex: 1 }}>
            {/* The live record catches up a moment after the save. */}
            {t.earnings.upiSavedAs(saved || typed)}
          </AppText>
          <Button
            title={t.earnings.upiChange}
            variant="ghost"
            compact
            onPress={() => {
              setNote(null);
              setTyped(saved || typed);
              setEditing(true);
            }}
            testID="upi-change"
          />
        </View>
        {note ? (
          <AppText variant="small" color={colors.success}>
            {note}
          </AppText>
        ) : null}
      </Card>
    );
  }

  return (
    <Card>
      <TextField
        label={t.earnings.upiLabel}
        placeholder={t.earnings.upiPlaceholder}
        value={typed}
        onChangeText={(v) => {
          setTyped(v);
          setError(null);
        }}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        keyboardType="email-address"
        returnKeyType="done"
        onSubmitEditing={() => void save()}
        maxLength={100}
        error={error ?? undefined}
        hint={t.earnings.upiHint}
        testID="upi-input"
      />
      <Button
        title={t.earnings.upiSave}
        icon="save-outline"
        compact
        onPress={() => void save()}
        loading={busy}
        disabled={!typed.trim()}
        testID="upi-save"
      />
    </Card>
  );
}

/** His stars from customers, and strikes for jobs given back (both written by the alerts robot). */
function RatingCard({ me }: { me: MyRecord }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Card>
      <AppText variant="small" color={colors.textFaint}>
        {t.earnings.ratingTitle}
      </AppText>
      {me.ratingAvg !== undefined ? (
        <View style={styles.row}>
          <Ionicons name="star" size={20} color={colors.amber} />
          <AppText variant="heading" weight="heavy">
            {t.earnings.rating(me.ratingAvg.toFixed(1), me.ratingCount)}
          </AppText>
        </View>
      ) : (
        <AppText color={colors.textMuted}>{t.earnings.noRatings}</AppText>
      )}
      {me.strikes > 0 ? (
        <>
          <AppText weight="bold" color={colors.danger}>
            {t.earnings.strikes(me.strikes)}
          </AppText>
          <AppText variant="small" color={colors.textMuted}>
            {t.earnings.strikesNote}
          </AppText>
        </>
      ) : null}
    </Card>
  );
}

const useStyles = makeStyles(() => ({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, flexWrap: 'wrap' },
}));

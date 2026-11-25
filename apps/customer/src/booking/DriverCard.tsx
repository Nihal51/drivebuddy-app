/**
 * The driver on the booking screen (SPEC-privacy, 25 Nov 2026). Customers
 * never get the driver's number, like Rapido: once DriveBuddy has confirmed
 * him they see his card — photo (or his initials), name, rating, trips,
 * experience, "Police verified" — and call DriveBuddy, never him. Before
 * that: "Driver found — DriveBuddy is confirming him". Before he sets off
 * they may ask for another driver, twice per booking ("Change driver").
 * booking/selfserve.ts decides what shows; the rules decide what is allowed.
 */

import { type Booking, CHANGE_REASON_MAX, type DriverCard, initialsOf } from '@drivebuddy/shared';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, Image, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Notice } from '@/components/bits';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { TextField } from '@/components/TextField';
import { useConfig } from '@/config/ConfigProvider';
import { requestDriverChange } from '@/data/selfserve';
import { useI18n } from '@/i18n';
import { driverCardLines } from '@/i18n/format';
import { callNumber, openWhatsapp } from '@/lib/links';
import { makeStyles, radius, space, useTheme } from '@/theme';

import { driverView } from './selfserve';

type Problem = 'error' | 'refused' | null;

/**
 * Everything the screen shows of the driver. `started`: he is sharing his
 * location (he has tapped Start), which the customer can see and the rules'
 * Start tap they cannot.
 */
export function DriverSection({
  booking,
  uid,
  started,
}: {
  booking: Booking;
  uid: string;
  started: boolean;
}) {
  const { t } = useI18n();
  const { config } = useConfig();
  const { colors } = useTheme();
  const styles = useStyles();
  // Here, not in the card: the card goes while the request is on its way
  // (the phone shows it at once) and comes back if the server refuses it.
  const [problem, setProblem] = useState<Problem>(null);
  const view = driverView(booking, uid, started);
  const ref = booking.ref ?? t.bookings.numbering;

  async function change(reason: string) {
    setProblem(null);
    const res = await requestDriverChange(booking.id, reason, config.alerts.pingUrl);
    if (!res.ok) setProblem(res.reason === 'permission' ? 'refused' : 'error');
  }

  if (view.kind === 'none') return null;

  if (view.kind === 'confirming' || view.kind === 'finding-another') {
    const confirming = view.kind === 'confirming';
    return (
      <Card tone="cream">
        <View style={styles.row} accessibilityLiveRegion="polite" testID="driver-waiting">
          <ActivityIndicator color={colors.amber} />
          <AppText weight="heavy" style={styles.flex}>
            {confirming ? t.detail.driver.confirming : t.detail.change.finding}
          </AppText>
        </View>
        <AppText variant="small" color={colors.textMuted}>
          {confirming ? t.detail.driver.confirmingBody : t.detail.change.findingBody}
        </AppText>
        <CallDriveBuddy refText={ref} />
      </Card>
    );
  }

  return (
    <DriverCardView
      card={view.card}
      current={view.current}
      changesLeft={view.changesLeft}
      canChange={view.canChange}
      refText={ref}
      problem={problem}
      onChange={change}
      onAsk={() => setProblem(null)}
    />
  );
}

function DriverCardView({
  card,
  current,
  changesLeft,
  canChange,
  refText,
  problem,
  onChange,
  onAsk,
}: {
  card: DriverCard;
  current: boolean;
  changesLeft: number;
  canChange: boolean;
  refText: string;
  problem: Problem;
  onChange: (reason: string) => Promise<void>;
  onAsk: () => void;
}) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useStyles();
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    await onChange(reason);
    setBusy(false);
    setAsking(false);
  }

  return (
    <Card tone="cream">
      <AppText variant="small" weight="heavy" color={colors.amberText}>
        {t.detail.yourDriver.toUpperCase()}
      </AppText>
      <View style={styles.row} testID="driver-card">
        <Avatar card={card} />
        <View style={styles.flex}>
          <AppText variant="heading" weight="heavy">
            {card.name}
          </AppText>
          {card.verified ? (
            <View style={styles.badge} testID="driver-verified">
              <Ionicons name="shield-checkmark" size={14} color={colors.success} />
              <AppText variant="tiny" weight="bold" color={colors.success}>
                {t.detail.driver.verified}
              </AppText>
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.lines} testID="driver-lines">
        {driverCardLines(t, card).map((line) => (
          <AppText key={line} variant="small" color={colors.textMuted}>
            {line}
          </AppText>
        ))}
      </View>

      {current ? (
        <>
          <CallDriveBuddy refText={refText} />
          <AppText variant="tiny" color={colors.textMuted}>
            {t.detail.driver.contactNote}
          </AppText>
        </>
      ) : null}

      {problem ? (
        <Notice
          text={problem === 'refused' ? t.detail.change.refused : t.detail.change.error}
          tone="danger"
        />
      ) : null}

      {canChange && !asking ? (
        <Button
          title={`${t.detail.change.button} (${t.detail.change.left(changesLeft)})`}
          icon="swap-horizontal"
          variant="ghost"
          compact
          onPress={() => {
            onAsk();
            setAsking(true);
          }}
          testID="change-driver"
        />
      ) : null}
      {canChange && asking ? (
        <View style={styles.confirm} testID="change-driver-confirm">
          <AppText weight="heavy" accessibilityRole="header">
            {t.detail.change.title}
          </AppText>
          <AppText variant="small" color={colors.textMuted}>
            {t.detail.change.body}
          </AppText>
          {changesLeft === 1 ? (
            <AppText variant="small" weight="bold">
              {t.detail.change.last}
            </AppText>
          ) : null}
          <TextField
            label={t.detail.change.reasonLabel}
            optionalLabel={t.common.optional}
            placeholder={t.detail.change.reasonPlaceholder}
            value={reason}
            onChangeText={setReason}
            maxLength={CHANGE_REASON_MAX}
            multiline
            testID="change-driver-reason"
          />
          <Button
            title={t.detail.change.confirm}
            icon="swap-horizontal"
            variant="dark"
            loading={busy}
            onPress={() => void send()}
            testID="change-driver-yes"
          />
          <Button
            title={t.detail.change.keep}
            variant="ghost"
            compact
            disabled={busy}
            onPress={() => setAsking(false)}
            testID="change-driver-keep"
          />
        </View>
      ) : null}
    </Card>
  );
}

/** His photo, or his initials until drivers have photos. */
function Avatar({ card }: { card: DriverCard }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useStyles();
  const [broken, setBroken] = useState(false);
  if (card.photoUrl && !broken) {
    return (
      <Image
        source={{ uri: card.photoUrl }}
        style={styles.avatar}
        accessibilityLabel={t.detail.driver.photo(card.name)}
        onError={() => setBroken(true)}
        testID="driver-photo"
      />
    );
  }
  return (
    <View style={[styles.avatar, styles.initials]} accessibilityElementsHidden importantForAccessibility="no">
      <AppText variant="heading" weight="heavy" color={colors.amberText} testID="driver-initials">
        {initialsOf(card.name)}
      </AppText>
    </View>
  );
}

/** Customers call DriveBuddy, never the driver: the office's number, and WhatsApp when there is one. */
function CallDriveBuddy({ refText }: { refText: string }) {
  const { t } = useI18n();
  const { contact } = useConfig().config;
  const styles = useStyles();
  return (
    <View style={styles.calls}>
      <Button
        title={t.detail.driver.call}
        icon="call"
        variant="dark"
        onPress={() => void callNumber(contact.phone)}
        testID="call-drivebuddy"
      />
      {contact.whatsapp ? (
        <Button
          title={t.common.whatsapp}
          icon="logo-whatsapp"
          variant="whatsapp"
          onPress={() => void openWhatsapp(contact.whatsapp, t.detail.helpMessage(refText))}
          testID="whatsapp-drivebuddy"
        />
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1, gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  lines: { gap: 2 },
  calls: { gap: space.sm },
  avatar: { width: 56, height: 56, borderRadius: radius.pill },
  initials: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.amberSoft,
    borderWidth: 1,
    borderColor: c.creamLine,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space.xs,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    backgroundColor: c.successSoft,
  },
  confirm: {
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.creamLine,
    backgroundColor: c.surface,
  },
}));

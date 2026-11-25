/**
 * Job alerts that actually arrive (SPEC-privacy §3). With the app closed a
 * new job reaches the driver only as a push notification, and until now a
 * push that failed (a missing Android key, a phone that dropped the app)
 * failed silently. Now the robot reads Expo's answer for every push and
 * writes it down, and the "Job alerts" card on the home screen shows him, in
 * words: notifications allowed? signed up on this phone (his push token
 * saved)? online? what became of the last alert? — and lets him send himself
 * a test alert.
 *
 *   availability/{driverId}.pushToken   this phone's token (tracking/sharing.ts)
 *   drivers/{driverId}.lastAlert        the last push's outcome (robot)
 *   alertTests/{driverId}               { at } he writes; { result } the robot adds
 */

import { type AlertResult, type AlertTest, toAlertTest } from '@drivebuddy/shared';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';

import { ringRobot } from '@/auth/robot';
import { firestore } from '@/firebase/app';

import { type WriteFailure, failureOf, within } from './write';

/* ----------------------------------------------------- this phone's token */

/**
 * The token this phone got in this run of the app. The availability document
 * holds the token of the phone he last used, so "signed up on this phone"
 * means it holds this one.
 */
let thisPhoneToken = '';
export const rememberPhoneToken = (token: string) => {
  if (token) thisPhoneToken = token;
};
export const phoneToken = () => thisPhoneToken;

/**
 * Drivers whose token this run of the app has saved: the Job alerts card
 * signs the phone up once per start (again only if that failed). Kept here,
 * not in the card, so logging out can clear it — whoever logs in next on
 * this phone, in the same run, is signed up afresh.
 */
const savedThisRun = new Set<string>();
export const tokenSavedThisRun = (driverId: string) => savedThisRun.has(driverId);
export const markTokenSaved = (driverId: string) => {
  if (driverId) savedThisRun.add(driverId);
};

/** Logging out: this run of the app forgets the phone's sign-up. */
export function forgetThisPhone(): void {
  savedThisRun.clear();
  thisPhoneToken = '';
}

/** Signed up for alerts on this phone: a token is saved, and (once this phone knows its own) it is this phone's. */
export const signedUpHere = (savedToken: string, mine: string = thisPhoneToken): boolean =>
  Boolean(savedToken) && (!mine || savedToken === mine);

/** What availability/{driverId} says about alerts: online, and the token saved there. */
export type Availability = { online: boolean; pushToken: string };

export function toAvailability(d: Record<string, unknown> | undefined): Availability | null {
  if (!d) return null;
  return { online: d.online === true, pushToken: typeof d.pushToken === 'string' ? d.pushToken : '' };
}

/** His availability document, live; null when there is none (never online, never signed up) or it cannot be read. */
export function watchAvailability(driverId: string, onChange: (a: Availability | null) => void): () => void {
  if (!driverId) {
    onChange(null);
    return () => {};
  }
  return onSnapshot(
    doc(firestore(), 'availability', driverId),
    (snap) => onChange(snap.exists() ? toAvailability(snap.data()) : null),
    () => onChange(null),
  );
}

/* --------------------------------------------------------------- the test */

/** The rules take a new test at most once a minute (alertTests: at < request.time − 1 min). */
export const TEST_EVERY_MS = 60_000;

export type TestView =
  | { kind: 'none' }
  /** Asked; the robot has not answered yet (its answer is usually there within a minute). */
  | { kind: 'waiting' }
  | { kind: 'done'; result: AlertResult };

/** A test document → what to show. A result older than the ask belongs to the test before. */
export function testView(test: AlertTest | null | undefined): TestView {
  if (!test) return { kind: 'none' };
  const r = test.result;
  if (r && (!test.at || !r.at || r.at.getTime() >= test.at.getTime())) return { kind: 'done', result: r };
  return { kind: 'waiting' };
}

/** May he ask again now? Not within a minute of the last ask (the server would refuse it). */
export const canAskTest = (test: AlertTest | null | undefined, now: number = Date.now()): boolean =>
  !test || (test.at ? now - test.at.getTime() >= TEST_EVERY_MS : testView(test).kind === 'done');

export type TestAsk = { ok: true } | { ok: false; reason: 'too-soon' | WriteFailure };

/**
 * "Send me a test alert": alertTests/{driverId} = { at: server time } —
 * replacing the last one, so its old result goes — then the robot's doorbell
 * ({ action: 'alert-test' }), so the push comes now rather than within the
 * hour. A refusal here is the once-a-minute limit (it is his own document).
 */
export async function askTestAlert(driverId: string): Promise<TestAsk> {
  try {
    await within(setDoc(doc(firestore(), 'alertTests', driverId), { at: serverTimestamp() }));
  } catch (err) {
    const reason = failureOf(err);
    return { ok: false, reason: reason === 'refused' ? 'too-soon' : reason };
  }
  ringRobot('alert-test');
  return { ok: true };
}

/** His test, live (the robot adds the result); null = none yet, or it cannot be read. */
export function watchAlertTest(driverId: string, onChange: (test: AlertTest | null) => void): () => void {
  if (!driverId) {
    onChange(null);
    return () => {};
  }
  return onSnapshot(
    doc(firestore(), 'alertTests', driverId),
    (snap) => onChange(snap.exists() ? (toAlertTest(snap.data()) ?? null) : null),
    () => onChange(null),
  );
}

/* ---------------------------------------------------------------- in words */

/**
 * Expo's error (or the robot's own) → what it means for him. 'settings': a
 * DriveBuddy setting is wrong (the Android key in Expo) — nothing he can do,
 * and the robot has told the office on Telegram.
 */
export type AlertErrorKind = 'NoToken' | 'DeviceNotRegistered' | 'NoReceipt' | 'settings' | 'other';

export function alertErrorKind(error: string | null): AlertErrorKind {
  switch (error) {
    case 'NoToken':
    case 'DeviceNotRegistered':
    case 'NoReceipt':
      return error;
    case 'InvalidCredentials':
    case 'MismatchSenderId':
      return 'settings';
    default:
      return 'other';
  }
}

/**
 * The card's verdict: alerts can reach this phone — notifications allowed,
 * signed up here, and the last alert (if any) arrived. Being offline is not a
 * fault: he just gets no new offers until he goes online.
 */
export const alertsWork = (c: {
  permission: 'granted' | 'ask' | 'blocked';
  signedUp: boolean;
  last?: AlertResult;
}): boolean => c.permission === 'granted' && c.signedUp && (c.last?.ok ?? true);

/** The newer of two outcomes (the last alert, the last test), so the card says what is true now. */
export function newest(a?: AlertResult, b?: AlertResult): AlertResult | undefined {
  if (!a || !b) return a ?? b;
  return (b.at?.getTime() ?? 0) > (a.at?.getTime() ?? 0) ? b : a;
}

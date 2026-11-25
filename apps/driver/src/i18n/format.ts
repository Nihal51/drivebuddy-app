/** Words built from data — times, package names — in the active language. Pure, so tested in both. */

import {
  type AlertResult,
  type PackageId,
  clock12,
  istDateKey,
  istParts,
  tripInstant,
} from '@drivebuddy/shared';

import { type TestView, alertErrorKind } from '@/data/alerts';

import type { Messages } from './en';

export function formatClock(t: Messages, hour: number, minute: number): string {
  return t.dates.time(hour, clock12(hour, minute).text);
}

/** "Today, 3:30 pm" or "Thu, 8 Oct, 3:30 pm" (India time). */
export function formatDateTime(t: Messages, at: Date | number, now: number = Date.now()): string {
  const p = istParts(at);
  const day =
    istDateKey(at) === istDateKey(now)
      ? t.dates.today
      : t.dates.day(t.dates.weekdays[p.weekday] ?? '', p.day, t.dates.months[p.month - 1] ?? '');
  return t.dates.dateTime(day, formatClock(t, p.hour, p.minute));
}

/** "3:30 pm" (India time), for "Last sent …". */
export function formatTime(t: Messages, at: Date | number): string {
  const p = istParts(at);
  return formatClock(t, p.hour, p.minute);
}

/** A booking's preferred time ("2026-10-08T15:30" or '') → words. */
export function formatPreferred(t: Messages, raw: string, now: number = Date.now()): string {
  if (!raw.trim()) return t.jobs.asap;
  const at = tripInstant(raw);
  return at ? formatDateTime(t, at, now) : raw;
}

export const packageName = (t: Messages, id: PackageId | null) => (id ? t.packages[id] : t.unknownPackage);

/** A failed login step → words. */
export function loginErrorText(
  t: Messages,
  f: { error: keyof Messages['login']['errors']; retryAt?: number; triesLeft?: number },
  now: number = Date.now(),
): string {
  const e = t.login.errors;
  switch (f.error) {
    case 'limit':
      return e.limit(f.retryAt ? formatDateTime(t, f.retryAt, now) : '24 h');
    case 'wrong-code':
      return e['wrong-code'](f.triesLeft ?? 0);
    default:
      return e[f.error];
  }
}

/** "98765 43210" for showing a number back to the driver. */
export const spacedPhone = (p: string) => (p.length === 10 ? `${p.slice(0, 5)} ${p.slice(5)}` : p);

/** Why a push did not arrive, in words he can act on. */
export const alertWhy = (t: Messages, error: string | null) => t.alerts.why[alertErrorKind(error)];

/** drivers/{id}.lastAlert → "Last alert reached this phone ✓ · Today, 10:42 am", or why it did not. */
export function lastAlertText(t: Messages, last: AlertResult | undefined, now: number = Date.now()): string {
  if (!last) return t.alerts.lastNone;
  const when = last.at ? formatDateTime(t, last.at, now) : t.dates.today;
  return last.ok ? t.alerts.lastOk(when) : t.alerts.lastFailed(when, alertWhy(t, last.error));
}

/** The test alert's state → a line, or null before he has asked for one. */
export function testText(t: Messages, view: TestView, now: number = Date.now()): string | null {
  if (view.kind === 'none') return null;
  if (view.kind === 'waiting') return t.alerts.testWaiting;
  const { result } = view;
  return result.ok
    ? t.alerts.testOk(result.at ? formatDateTime(t, result.at, now) : t.dates.today)
    : t.alerts.testFailed(alertWhy(t, result.error));
}

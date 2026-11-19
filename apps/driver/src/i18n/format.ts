/** Words built from data — times, package names — in the active language. Pure, so tested in both. */

import { type PackageId, clock12, istDateKey, istParts, tripInstant } from '@drivebuddy/shared';

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

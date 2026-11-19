/**
 * The two calls to the alerts robot (apps-script/Code.js, "driver login") that
 * turn a mobile number and an SMS code into a login. The robot keeps the SMS
 * provider's password and the signing key; the app only ever sees a session id
 * and, once the code is right, a Firebase custom token.
 */

import { env } from '@/env';

export type LoginError =
  | 'bad-phone'
  | 'not-a-driver'
  | 'limit'
  | 'busy'
  | 'sms-failed'
  | 'not-configured'
  | 'wrong-code'
  | 'expired'
  | 'too-many-tries'
  | 'network'
  | 'unavailable';

const KNOWN: readonly LoginError[] = [
  'bad-phone',
  'not-a-driver',
  'limit',
  'busy',
  'sms-failed',
  'not-configured',
  'wrong-code',
  'expired',
  'too-many-tries',
  'network',
  'unavailable',
];

export type CodeSent = { ok: true; session: string; left: number };
export type LoggedIn = { ok: true; token: string; name: string; phone: string };
export type Failed = { ok: false; error: LoginError; retryAt?: number; triesLeft?: number };

/** "+91 98765-43210" → "9876543210", or '' if it is not an Indian mobile number. */
export function tenDigits(raw: string): string {
  let d = raw.replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : '';
}

/** Whatever came back → a typed answer. Anything unexpected is 'unavailable', never a crash. */
export function readAnswer<T extends { ok: true }>(
  body: unknown,
  isOk: (b: Record<string, unknown>) => boolean,
): T | Failed {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'unavailable' };
  const b = body as Record<string, unknown>;
  if (b.ok === true && isOk(b)) return b as unknown as T;
  const error = KNOWN.includes(b.error as LoginError) ? (b.error as LoginError) : 'unavailable';
  return {
    ok: false,
    error,
    ...(typeof b.retryAt === 'number' ? { retryAt: b.retryAt } : {}),
    ...(typeof b.triesLeft === 'number' ? { triesLeft: b.triesLeft } : {}),
  };
}

async function call(payload: Record<string, string>, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // text/plain: Apps Script reads the body as-is, and browsers send it without a preflight.
    const res = await fetch(env.robotUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function requestCode(phone: string, timeoutMs = 25_000): Promise<CodeSent | Failed> {
  try {
    const body = await call({ action: 'driver-otp', phone }, timeoutMs);
    return readAnswer<CodeSent>(body, (b) => typeof b.session === 'string');
  } catch {
    return { ok: false, error: 'network' };
  }
}

export async function verifyCode(
  session: string,
  code: string,
  timeoutMs = 25_000,
): Promise<LoggedIn | Failed> {
  try {
    const body = await call({ action: 'driver-verify', session, code }, timeoutMs);
    return readAnswer<LoggedIn>(body, (b) => typeof b.token === 'string');
  } catch {
    return { ok: false, error: 'network' };
  }
}

/**
 * The cash limit (SPEC-upi item 11): how much of DriveBuddy's cash a driver
 * may hold before new offers stop reaching him. Not a Firestore field: the
 * website publishes it as `payments.cashLimit` in app-config.json (the file
 * the customer app reads its prices from), so the Driver app downloads that
 * file the same way — plain fetch with a time limit, the last good value
 * saved on the phone, and the built-in 2000 when there is neither.
 */

import { DEFAULT_CASH_LIMIT, parseCashLimit } from '@drivebuddy/shared';

import { env } from '@/env';
import { readJson, writeJson } from '@/lib/storage';

export const CONFIG_URL = `${env.siteUrl}/app-config.json`;
const CACHE_KEY = 'dbd.cashLimit.v1';
const TIMEOUT_MS = 8000;

/** The website's limit, or null (offline, timed out, not JSON, no or odd `payments.cashLimit`). */
export async function fetchCashLimit(fetchImpl: typeof fetch = fetch): Promise<number | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // The query string defeats a stale CDN/HTTP cache between deploys (as in the customer app).
    const res = await fetchImpl(`${CONFIG_URL}?t=${Math.floor(Date.now() / 60_000)}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return parseCashLimit(await res.json());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** The limit saved from the last good download, or null. */
export async function savedCashLimit(): Promise<number | null> {
  return parseCashLimit({ payments: { cashLimit: await readJson<unknown>(CACHE_KEY) } });
}

/**
 * The limit to go by, as it becomes known: the saved one (or the built-in
 * one) at once, then the downloaded one. Returns a cancel for unmounting.
 */
export function loadCashLimit(
  onChange: (limit: number) => void,
  fetchImpl: typeof fetch = fetch,
): () => void {
  let alive = true;
  let live = false;
  void savedCashLimit().then((saved) => {
    if (alive && !live) onChange(saved ?? DEFAULT_CASH_LIMIT);
  });
  void fetchCashLimit(fetchImpl).then((limit) => {
    if (!alive || limit === null) return;
    live = true;
    onChange(limit);
    void writeJson(CACHE_KEY, limit);
  });
  return () => {
    alive = false;
  };
}

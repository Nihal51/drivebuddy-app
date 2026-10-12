/**
 * Downloads the live prices and phone numbers from the website
 * (https://thedrivebuddy.in/app-config.json, generated from site-settings.ts on
 * every website deploy). See packages/shared/src/config.ts for why.
 */

import { type AppConfig, parseAppConfig } from '@drivebuddy/shared';

import { env } from '@/env';
import { readJson, writeJson } from '@/lib/storage';

export const CONFIG_URL = `${env.siteUrl}/app-config.json`;
const CACHE_KEY = 'db.config.v1';
const TIMEOUT_MS = 8000;

export async function fetchRemoteConfig(fetchImpl: typeof fetch = fetch): Promise<AppConfig | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // The query string defeats any stale CDN/HTTP cache between deploys.
    const res = await fetchImpl(`${CONFIG_URL}?t=${Math.floor(Date.now() / 60_000)}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return parseAppConfig(await res.json());
  } catch {
    return null; // offline, timed out, or not JSON — keep what we have
  } finally {
    clearTimeout(timer);
  }
}

export async function loadCachedConfig(): Promise<AppConfig | null> {
  return parseAppConfig(await readJson<unknown>(CACHE_KEY));
}

export const cacheConfig = (config: AppConfig) => writeJson(CACHE_KEY, config);

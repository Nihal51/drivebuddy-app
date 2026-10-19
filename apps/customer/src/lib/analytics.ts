/**
 * Anonymous usage stats: which screens and services people use, where a
 * booking gets stuck — so you can improve the app with numbers, not guesses.
 *
 * - Off until EXPO_PUBLIC_POSTHOG_KEY is set in .env (PostHog's free plan;
 *   docs/SETUP.md, "Usage stats"). Never in development.
 * - Anonymous: a random id made on the phone, never linked to a login, a name,
 *   a number or an address. Only the fields listed in `Props` can be sent.
 * - The customer can switch it off in Account; the choice is kept on the phone.
 * - Events are sent in small batches; anything that fails is simply dropped.
 */

import Constants from 'expo-constants';
import { AppState, Platform } from 'react-native';

import { readStored, writeStored } from './storage';

export type AnalyticsEvent =
  | 'app_opened'
  | 'booking_form_opened'
  | 'booking_submitted'
  | 'booking_failed'
  | 'whatsapp_fallback_used'
  | 'login_completed'
  | 'logged_out'
  | 'language_changed'
  | 'notifications_enabled';

/** The only properties that can ever leave the phone. */
export type Props = {
  package?: string;
  city?: string;
  when?: 'asap' | 'scheduled';
  loggedIn?: boolean;
  reason?: string;
  language?: 'en' | 'hi';
};

const KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '';
const HOST = (process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com').replace(/\/+$/, '');
const configured = Boolean(KEY) && !__DEV__ && Platform.OS !== 'web';

const OPT_OUT_KEY = 'db.analytics.off';
const ID_KEY = 'db.analytics.id';

let optedOut = false;
let anonId = '';
let queue: object[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;
let ready: Promise<void> | undefined;

/** 32 random hex characters, made on the phone — not tied to anyone. */
function randomId(): string {
  let id = '';
  for (let i = 0; i < 32; i++) id += Math.floor(Math.random() * 16).toString(16);
  return id;
}

function init(): Promise<void> {
  ready ??= (async () => {
    optedOut = (await readStored(OPT_OUT_KEY)) === '1';
    anonId = (await readStored(ID_KEY)) || '';
    if (!anonId) {
      anonId = randomId();
      await writeStored(ID_KEY, anonId);
    }
    AppState.addEventListener('change', (s) => {
      if (s !== 'active') void flush();
    });
  })();
  return ready;
}

/** Whether stats can be sent at all in this build (a key is set). */
export const analyticsAvailable = () => Boolean(KEY);

export async function isAnalyticsOn(): Promise<boolean> {
  await init();
  return !optedOut;
}

export async function setAnalyticsOn(on: boolean): Promise<void> {
  await init();
  optedOut = !on;
  if (!on) queue = [];
  await writeStored(OPT_OUT_KEY, on ? '' : '1');
}

export function track(event: AnalyticsEvent, props: Props = {}): void {
  if (!configured) return;
  void init().then(() => {
    if (optedOut) return;
    queue.push({
      event,
      distinct_id: anonId,
      timestamp: new Date().toISOString(),
      properties: {
        ...props,
        $process_person_profile: false,
        platform: Platform.OS,
        app_version: Constants.expoConfig?.version ?? '',
      },
    });
    clearTimeout(timer);
    timer = setTimeout(() => void flush(), queue.length >= 10 ? 0 : 15_000);
  });
}

async function flush(): Promise<void> {
  if (!queue.length) return;
  const batch = queue;
  queue = [];
  try {
    await fetch(`${HOST}/batch/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: KEY, batch }),
    });
  } catch {
    /* offline: these few events are not worth keeping */
  }
}

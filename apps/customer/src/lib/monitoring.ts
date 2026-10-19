/**
 * Crash and error reports (Sentry), so a crash on a customer's phone reaches
 * you instead of disappearing. Off until EXPO_PUBLIC_SENTRY_DSN is set in .env
 * (docs/SETUP.md, "Crash reports"), and always off in development, where
 * errors show in the terminal instead.
 *
 * Privacy: reports carry the error, the screen and the phone model — never the
 * customer's name, number or address. `sendDefaultPii` is off and the user
 * and request details are stripped before anything leaves the phone.
 */

import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import type { ComponentType } from 'react';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';
const enabled = Boolean(dsn) && !__DEV__;

export function initMonitoring() {
  if (!enabled) return;
  Sentry.init({
    dsn,
    sendDefaultPii: false,
    // Errors only: no performance tracing, no session replay — the free plan is plenty.
    tracesSampleRate: 0,
    environment: (Constants.expoConfig?.extra as { variant?: string } | undefined)?.variant ?? 'production',
    beforeSend(event) {
      delete event.user;
      delete event.request;
      return event;
    },
  });
}

/** Report something that went wrong but did not crash, with a short label of where. */
export function reportError(err: unknown, area: string) {
  if (!enabled) return;
  Sentry.captureException(err, { tags: { area } });
}

/** Wraps the root so crashes inside React are reported (a no-op while off). */
export function withMonitoring(Root: ComponentType): ComponentType {
  return enabled ? Sentry.wrap(Root as ComponentType<Record<string, unknown>>) : Root;
}

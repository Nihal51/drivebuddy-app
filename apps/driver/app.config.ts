/**
 * The DriveBuddy Driver app: a separate app from the customer app, for the
 * team's drivers only. They log in with their mobile number and an SMS code,
 * see the jobs the office assigned to them, call the customer, navigate to the
 * pickup, and share their live location between Start and Arrived.
 *
 * Two variants, picked by APP_VARIANT (set per profile in eas.json):
 *   production   "DriveBuddy Driver",        in.thedrivebuddy.driver      → Google Play
 *   development  "DriveBuddy Driver (Dev)",  in.thedrivebuddy.driver.dev  → your test phone
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type { ConfigContext, ExpoConfig } from 'expo/config';

const IS_DEV = process.env.APP_VARIANT === 'development';

/**
 * The "DriveBuddy Driver" project on expo.dev (expo.dev/accounts/thedrivebuddy/projects/drivebuddy-driver),
 * separate from the customer app's.
 */
const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID || 'e90ab391-66e3-4d1b-8196-13f05163b165';
const APP_ID = IS_DEV ? 'in.thedrivebuddy.driver.dev' : 'in.thedrivebuddy.driver';

/**
 * Firebase's Android file (public identifiers, safe to commit): job alerts
 * (push notifications) need it. Without it the app builds and works, only
 * without alerts.
 */
const googleServicesFile = existsSync(join(__dirname, 'google-services.json'))
  ? './google-services.json'
  : undefined;

/** Brand colours, also in src/theme.tsx. The driver app's icon is amber, so the two apps never get mixed up. */
const AMBER = '#F59E0B';
const WHITE = '#FFFFFF';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: IS_DEV ? 'DriveBuddy Driver (Dev)' : 'DriveBuddy Driver',
  slug: 'drivebuddy-driver',
  owner: process.env.EXPO_OWNER || 'thedrivebuddy',
  scheme: 'drivebuddydriver',
  // 1.1.0: job alerts (expo-notifications) — a new native module, so a new
  // runtime: the 1.0.0 test build does not get updates that need it.
  version: '1.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  runtimeVersion: { policy: 'appVersion' },
  updates: EAS_PROJECT_ID
    ? {
        url: `https://u.expo.dev/${EAS_PROJECT_ID}`,
        checkAutomatically: 'ON_LOAD',
        fallbackToCacheTimeout: 0,
      }
    : { enabled: false },
  userInterfaceStyle: 'automatic',
  backgroundColor: WHITE,
  ios: {
    bundleIdentifier: APP_ID,
    supportsTablet: false,
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  android: {
    package: APP_ID,
    allowBackup: false,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      monochromeImage: './assets/adaptive-icon-monochrome.png',
      backgroundColor: AMBER,
    },
    ...(googleServicesFile ? { googleServicesFile } : {}),
    // Location only while the driver is sharing it on a job: a foreground
    // service started by his tap on Start, with a notification he can see the
    // whole time, until he taps Arrived. No background-location permission,
    // so the Play review is the simpler "foreground service" one.
    permissions: [
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_LOCATION',
      'android.permission.POST_NOTIFICATIONS',
    ],
    blockedPermissions: [
      'android.permission.ACCESS_BACKGROUND_LOCATION',
      'com.google.android.gms.permission.AD_ID',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.RECORD_AUDIO',
      'android.permission.CAMERA',
    ],
  },
  web: { favicon: './assets/favicon.png', output: 'single', bundler: 'metro' },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-localization',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'DriveBuddy Driver shares your location with the customer only between Start and Arrived on a job.',
        isAndroidBackgroundLocationEnabled: false,
        isAndroidForegroundServiceEnabled: true,
        isIosBackgroundLocationEnabled: false,
      },
    ],
    ['expo-notifications', { icon: './assets/notification-icon.png', color: AMBER, defaultChannel: 'jobs' }],
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 180,
        backgroundColor: WHITE,
        dark: { image: './assets/splash-icon-dark.png', backgroundColor: '#0C0A09' },
      },
    ],
  ],
  experiments: { typedRoutes: true },
  extra: {
    ...config.extra,
    variant: IS_DEV ? 'development' : 'production',
    eas: { ...config.extra?.eas, ...(EAS_PROJECT_ID ? { projectId: EAS_PROJECT_ID } : {}) },
  },
});

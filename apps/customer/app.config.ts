/**
 * The app's identity and native settings. EAS Build and `expo prebuild`
 * generate the Android and iOS projects from this file, so it is the only
 * place to change the name, version, icons or permissions.
 *
 * Two variants, picked by APP_VARIANT (set per profile in eas.json):
 *   production   "DriveBuddy",        in.thedrivebuddy.app       → the stores
 *   development  "DriveBuddy (Dev)",  in.thedrivebuddy.app.dev   → your test phone
 * Different ids let the test app sit next to the store app on the same phone.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type { ConfigContext, ExpoConfig } from 'expo/config';

const IS_DEV = process.env.APP_VARIANT === 'development';

/** From `eas init` (also on expo.dev → your project). Empty = notifications off. */
const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID || '';
const APP_ID = IS_DEV ? 'in.thedrivebuddy.app.dev' : 'in.thedrivebuddy.app';

/** Brand colours, also in src/theme.ts. */
const AMBER = '#F59E0B';
const WHITE = '#FFFFFF';

/**
 * Firebase's native config files. They hold public identifiers only (like the
 * website's .env.production) and are safe to commit. Download them from the
 * Firebase console once the Android / iOS app is registered there — see
 * docs/SETUP.md. Until then the app still builds; Google login and
 * notifications simply stay off on that platform.
 */
const here = (file: string) => (existsSync(join(__dirname, file)) ? `./${file}` : undefined);
const googleServicesFile = here('google-services.json');
const iosGoogleServicesFile = here('GoogleService-Info.plist');

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: IS_DEV ? 'DriveBuddy (Dev)' : 'DriveBuddy',
  slug: 'drivebuddy',
  // Your Expo account name, set once `eas init` has run (see docs/SETUP.md).
  ...(process.env.EXPO_OWNER ? { owner: process.env.EXPO_OWNER } : {}),
  scheme: 'drivebuddy',
  // Shown in the stores. Bump for every store release; EAS bumps the build numbers itself.
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  // Over-the-air updates (EAS Update): text, screens and bug fixes reach installed
  // apps without a store review. A change that adds a native module bumps
  // `version`, which starts a new runtime, so old apps never get code they cannot run.
  runtimeVersion: { policy: 'appVersion' },
  updates: EAS_PROJECT_ID
    ? {
        url: `https://u.expo.dev/${EAS_PROJECT_ID}`,
        checkAutomatically: 'ON_LOAD',
        fallbackToCacheTimeout: 0,
      }
    : { enabled: false },
  userInterfaceStyle: 'light',
  backgroundColor: WHITE,
  ios: {
    bundleIdentifier: APP_ID,
    supportsTablet: false,
    ...(iosGoogleServicesFile ? { googleServicesFile: iosGoogleServicesFile } : {}),
    infoPlist: {
      // The app uses only standard HTTPS — no export-compliance paperwork.
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: APP_ID,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      monochromeImage: './assets/adaptive-icon-monochrome.png',
      backgroundColor: WHITE,
    },
    ...(googleServicesFile ? { googleServicesFile } : {}),
    // Nothing beyond internet and notifications. No location, contacts or storage:
    // fewer permissions = a simpler Play "Data safety" form and more trust.
    blockedPermissions: [
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.RECORD_AUDIO',
    ],
  },
  web: {
    favicon: './assets/favicon.png',
    output: 'single',
    bundler: 'metro',
  },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-localization',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 180,
        backgroundColor: WHITE,
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: AMBER,
        defaultChannel: 'bookings',
      },
    ],
    // Reads google-services.json / GoogleService-Info.plist when present.
    '@react-native-google-signin/google-signin',
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    ...config.extra,
    eas: {
      ...config.extra?.eas,
      // Push notifications need the EAS project id. `eas init` prints it; paste it
      // into EAS_PROJECT_ID at the top of this file (docs/SETUP.md, step 3).
      ...(EAS_PROJECT_ID ? { projectId: EAS_PROJECT_ID } : {}),
    },
  },
});

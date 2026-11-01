/* Native modules have no implementation under Jest; these stand-ins keep tests on our own logic. */

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);
jest.mock('@sentry/react-native', () => ({ init: jest.fn(), captureException: jest.fn(), wrap: (c) => c }));
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ status: 'undetermined', canAskAgain: true })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'denied', canAskAgain: false })),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: 'ExponentPushToken[test-token-1]' })),
  setNotificationChannelAsync: jest.fn(async () => null),
  useLastNotificationResponse: () => null,
  AndroidImportance: { HIGH: 4 },
}));
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(async () => true),
    signIn: jest.fn(),
    signOut: jest.fn(async () => null),
  },
  isCancelledResponse: (r) => r?.type === 'cancelled',
  isErrorWithCode: (e) => typeof e?.code === 'string',
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
    SIGN_IN_REQUIRED: 'SIGN_IN_REQUIRED',
  },
}));

// Public identifiers, as in .env — so code paths that need "Firebase configured" run.
process.env.EXPO_PUBLIC_FIREBASE_API_KEY = 'test-api-key';
process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID = 'drive-buddy-test';
process.env.EXPO_PUBLIC_SITE_URL = 'https://thedrivebuddy.in';

// The pickup location: GPS and the map (a web view) are native; tests drive them by hand.
jest.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(async () => ({
    coords: { latitude: 21.251384, longitude: 81.629641, accuracy: 14.6 },
  })),
}));
jest.mock('react-native-webview', () => {
  const { View } = require('react-native');
  const React = require('react');
  const WebView = React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => ({ injectJavaScript: jest.fn() }));
    return React.createElement(View, { testID: props.testID, onMessage: props.onMessage });
  });
  WebView.displayName = 'WebView';
  return { WebView };
});

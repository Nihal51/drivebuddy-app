// Expo's Metro setup (it finds the monorepo's packages by itself), plus Sentry's
// debug IDs so crash reports can point at the exact line of source code.
// https://docs.sentry.io/platforms/react-native/manual-setup/expo/
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

module.exports = getSentryExpoConfig(__dirname);

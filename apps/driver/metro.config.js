// Expo's Metro setup; it finds the monorepo's packages (packages/shared) by itself.
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);

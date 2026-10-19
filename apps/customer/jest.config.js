/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.js'],
  testMatch: ['**/*.test.[jt]s?(x)'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  // Workspace packages ship TypeScript source; let Babel compile them too.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-native/.*|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|expo-router|@drivebuddy/.*|firebase|@firebase/.*))',
  ],
  // `npm run test:coverage`. Counts every source file, not only the ones a test
  // happens to load, so a new untested screen shows up as a drop. The floor
  // sits a little under today's numbers: CI fails if coverage goes down, and
  // it should be raised as tests are added (booking flow and auth first).
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/__tests__/**', '!src/**/*.test.*'],
  coverageThreshold: {
    global: { statements: 44, branches: 37, functions: 43, lines: 45 },
  },
};

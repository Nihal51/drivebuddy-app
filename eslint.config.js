// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.expo/**',
      '**/coverage/**',
      'apps/*/android/**',
      'apps/*/ios/**',
    ],
  },
  {
    settings: {
      // Workspace aliases: '@/…' inside each app, '@drivebuddy/shared' across the repo.
      'import/resolver': {
        typescript: { project: ['apps/*/tsconfig.json', 'packages/*/tsconfig.json'] },
      },
    },
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
      'react/jsx-no-useless-fragment': 'warn',
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/jest.setup.js'],
    languageOptions: {
      globals: {
        jest: 'readonly',
        describe: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        it: 'readonly',
        beforeEach: 'readonly',
      },
    },
  },
]);

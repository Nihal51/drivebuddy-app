import { DEFAULT_CONFIG } from '@drivebuddy/shared';
import { screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import HomeScreen from '@/app/(tabs)/index';
import { UpdateGate } from '@/components/UpdateGate';
import { palettes } from '@/theme';

import { renderScreen } from './test-utils';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), dismissTo: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
  Stack: { Screen: () => null },
}));
jest.mock('expo-application', () => ({ nativeApplicationVersion: '1.0.0', nativeBuildVersion: '1' }));

const requiring = (minVersion: string) => ({
  ...DEFAULT_CONFIG,
  app: { ...DEFAULT_CONFIG.app, minVersion, appStoreUrl: 'https://apps.apple.com/in/app/drivebuddy/id1' },
});

describe('the "please update" switch', () => {
  test('an app older than the website’s minimum shows the update screen instead of the app', async () => {
    await renderScreen(
      <UpdateGate>
        <Text>the app</Text>
      </UpdateGate>,
      { config: requiring('1.2.0'), configSource: 'live' },
    );
    expect(screen.getByText('Please update DriveBuddy')).toBeOnTheScreen();
    expect(screen.getByText('Update now')).toBeOnTheScreen();
    expect(screen.queryByText('the app')).toBeNull();
  });

  test('a current app, or a minimum only from the built-in copy, opens normally', async () => {
    await renderScreen(
      <UpdateGate>
        <Text>the app</Text>
      </UpdateGate>,
      { config: requiring('1.0.0'), configSource: 'live' },
    );
    expect(screen.getByText('the app')).toBeOnTheScreen();
    await renderScreen(
      <UpdateGate>
        <Text>the app</Text>
      </UpdateGate>,
      { config: requiring('9.0.0'), configSource: 'built-in' },
    );
    expect(screen.getByText('the app')).toBeOnTheScreen();
  });
});

describe('dark theme', () => {
  test('Home renders with the dark palette', async () => {
    await renderScreen(<HomeScreen />, { scheme: 'dark' });
    const title = screen.getByText('Your driver, at your door in 30 minutes');
    expect(title).toBeOnTheScreen();
    // Text in the dark palette; the dark service card in its dark colour.
    expect(title).toHaveStyle({ color: palettes.dark.text });
    expect(screen.getByTestId('tile-drop')).toHaveStyle({ backgroundColor: palettes.dark.feature });
  });

  test('both palettes define every colour', () => {
    expect(Object.keys(palettes.dark).sort()).toEqual(Object.keys(palettes.light).sort());
  });
});

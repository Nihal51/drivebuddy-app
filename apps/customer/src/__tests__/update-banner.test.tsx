import { fireEvent, screen } from '@testing-library/react-native';
import * as Updates from 'expo-updates';

import { LiveUpdateBanner } from '@/components/UpdateBanner';

import { renderScreen } from './test-utils';

jest.mock('expo-updates', () => ({
  isEnabled: true,
  useUpdates: jest.fn(),
  checkForUpdateAsync: jest.fn(async () => ({})),
  fetchUpdateAsync: jest.fn(async () => ({})),
  reloadAsync: jest.fn(async () => {}),
}));

const state = (
  s: Partial<{ isUpdateAvailable: boolean; isUpdatePending: boolean; isDownloading: boolean }>,
) =>
  (Updates.useUpdates as jest.Mock).mockReturnValue({
    isUpdateAvailable: false,
    isUpdatePending: false,
    isDownloading: false,
    ...s,
  });

beforeEach(() => jest.clearAllMocks());

test('nothing new: no note', async () => {
  state({});
  await renderScreen(<LiveUpdateBanner />);
  expect(screen.queryByTestId('update-banner')).toBeNull();
});

test('a new version is found: it downloads by itself, still no note', async () => {
  state({ isUpdateAvailable: true });
  await renderScreen(<LiveUpdateBanner />);
  expect(Updates.fetchUpdateAsync).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId('update-banner')).toBeNull();
});

test('downloaded: the note says so, and Update restarts on the new version', async () => {
  state({ isUpdateAvailable: true, isUpdatePending: true });
  await renderScreen(<LiveUpdateBanner />);
  expect(screen.getByText('New version ready')).toBeOnTheScreen();
  await fireEvent.press(screen.getByTestId('update-now'));
  expect(Updates.reloadAsync).toHaveBeenCalledTimes(1);
});

test('Later hides the note', async () => {
  state({ isUpdatePending: true });
  await renderScreen(<LiveUpdateBanner />);
  await fireEvent.press(screen.getByTestId('update-later'));
  expect(screen.queryByTestId('update-banner')).toBeNull();
  expect(Updates.reloadAsync).not.toHaveBeenCalled();
});

test('in Hindi too', async () => {
  state({ isUpdatePending: true });
  await renderScreen(<LiveUpdateBanner />, { lang: 'hi' });
  expect(screen.getByText('नया वर्ज़न तैयार है')).toBeOnTheScreen();
});

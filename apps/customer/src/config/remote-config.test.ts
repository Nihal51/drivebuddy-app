import { DEFAULT_CONFIG } from '@drivebuddy/shared';

import { cacheConfig, fetchRemoteConfig, loadCachedConfig } from './remote-config';

const respond = (body: unknown, ok = true) =>
  jest.fn(async () => ({ ok, json: async () => body }) as unknown as Response) as unknown as typeof fetch;

test('a good file from the website is used', async () => {
  const live = { ...DEFAULT_CONFIG, prices: { ...DEFAULT_CONFIG.prices, oneHour: 350 } };
  const fetchImpl = respond(live);
  await expect(fetchRemoteConfig(fetchImpl)).resolves.toEqual(live);
  expect((fetchImpl as jest.Mock).mock.calls[0][0]).toMatch(
    /^https:\/\/thedrivebuddy\.in\/app-config\.json\?t=\d+$/,
  );
});

test('a broken file, an error page or no internet keep the current prices', async () => {
  await expect(fetchRemoteConfig(respond({ schema: 1, prices: 'oops' }))).resolves.toBeNull();
  await expect(fetchRemoteConfig(respond(DEFAULT_CONFIG, false))).resolves.toBeNull();
  const offline = jest.fn(async () => {
    throw new TypeError('Network request failed');
  }) as unknown as typeof fetch;
  await expect(fetchRemoteConfig(offline)).resolves.toBeNull();
});

test('the last good file is remembered on the phone', async () => {
  await expect(loadCachedConfig()).resolves.toBeNull();
  await cacheConfig(DEFAULT_CONFIG);
  await expect(loadCachedConfig()).resolves.toEqual(DEFAULT_CONFIG);
});

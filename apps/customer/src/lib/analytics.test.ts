import { isAnalyticsOn, setAnalyticsOn, track } from './analytics';

test('the choice to turn usage stats off is remembered on the phone', async () => {
  await expect(isAnalyticsOn()).resolves.toBe(true);
  await setAnalyticsOn(false);
  await expect(isAnalyticsOn()).resolves.toBe(false);
  await setAnalyticsOn(true);
  await expect(isAnalyticsOn()).resolves.toBe(true);
});

test('without a key (and always in development) nothing is sent', async () => {
  const spy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
  track('app_opened');
  await new Promise((r) => setTimeout(r, 20));
  expect(spy).not.toHaveBeenCalled();
  spy.mockRestore();
});

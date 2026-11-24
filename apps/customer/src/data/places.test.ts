import { DEFAULT_CONFIG } from '@drivebuddy/shared';
import { act, renderHook } from '@testing-library/react-native';

import { cachePlaces, cachedPlaces, fetchPlaces, forgetPlaces, placesUrl, usePlaces } from './places';

const FILE = {
  fields: ['name', 'state', 'lat', 'lng', 'population', 'station', 'altName'],
  places: [
    ['Kochi', 'Kerala', 9.9399, 76.2602, 604696, 'ERS', 'Cochin, Ernakulam'],
    ['Prayagraj', 'Uttar Pradesh', 25.4448, 81.8432, 1073438, 'ALY', 'Allahabad, Ilahabad'],
  ],
};
const answer = (body: unknown, ok = true) =>
  jest.fn(async () => ({ ok, json: async () => body })) as unknown as typeof fetch;

beforeEach(() => forgetPlaces());

test('the list is at the address the website gives, else its site url + /data/india-places.json', () => {
  expect(placesUrl(DEFAULT_CONFIG)).toBe('https://thedrivebuddy.in/data/india-places.json');
  expect(placesUrl({ site: { ...DEFAULT_CONFIG.site, places: 'https://thedrivebuddy.in/x.json' } })).toBe(
    'https://thedrivebuddy.in/x.json',
  );
});

test('downloaded and checked; offline, an error page or not the list → null', async () => {
  await expect(fetchPlaces('https://x.in/p.json', answer(FILE))).resolves.toHaveLength(2);
  await expect(fetchPlaces('https://x.in/p.json', answer(FILE, false))).resolves.toBeNull();
  await expect(fetchPlaces('https://x.in/p.json', answer({ hello: 1 }))).resolves.toBeNull();
  const offline = jest.fn(async () => {
    throw new Error('offline');
  }) as unknown as typeof fetch;
  await expect(fetchPlaces('https://x.in/p.json', offline)).resolves.toBeNull();
});

test('kept on the phone and read back', async () => {
  const places = await fetchPlaces('https://x.in/p.json', answer(FILE));
  await cachePlaces(places ?? []);
  await expect(cachedPlaces()).resolves.toEqual(places);
});

test('the box: no internet and nothing kept → offline (the curated list only); a kept copy → ready', async () => {
  const realFetch = global.fetch;
  global.fetch = jest.fn(async () => {
    throw new Error('offline');
  }) as unknown as typeof fetch;
  await cachePlaces([]);
  const { result } = await renderHook(() => usePlaces(DEFAULT_CONFIG));
  expect(result.current.state).toBe('idle');
  await act(async () => result.current.load());
  await act(async () => new Promise((r) => setTimeout(r, 0)));
  expect(result.current).toMatchObject({ state: 'offline', places: null });

  forgetPlaces();
  await cachePlaces((await fetchPlaces('https://x.in/p.json', answer(FILE))) ?? []);
  const again = await renderHook(() => usePlaces(DEFAULT_CONFIG));
  await act(async () => again.result.current.load());
  await act(async () => new Promise((r) => setTimeout(r, 0)));
  expect(again.result.current.state).toBe('ready');
  expect(again.result.current.places?.map((p) => p.name)).toEqual(['Kochi', 'Prayagraj']);
  global.fetch = realFetch;
});

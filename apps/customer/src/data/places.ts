/**
 * The list of all India for the place box (packages/shared places.ts): the
 * website's /data/india-places.json, downloaded the first time the box is
 * used — like app-config.json, never bundled in the app — with the last good
 * copy kept on the phone for the next time (and for no internet). Without
 * either, the box searches the curated destinations only.
 */

import { type AppConfig, PLACES_PATH, type Place, parsePlaces } from '@drivebuddy/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

import { readJson, writeJson } from '@/lib/storage';

const CACHE_KEY = 'db.places.v1';
const TIMEOUT_MS = 10_000;

/** Where the list is: the address the website's config gives, else its site url + PLACES_PATH. */
export const placesUrl = (config: Pick<AppConfig, 'site'>): string =>
  config.site.places ?? `${config.site.url}${PLACES_PATH}`;

/** The list from the website, or null (offline, timed out, not the list). */
export async function fetchPlaces(url: string, fetchImpl: typeof fetch = fetch): Promise<Place[] | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // The query string (changing once a day) gets past a stale CDN copy after the list is rebuilt.
    const res = await fetchImpl(`${url}?d=${Math.floor(Date.now() / 86_400_000)}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const places = parsePlaces(await res.json());
    return places.length ? places : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** The copy kept on the phone, or null. */
export async function cachedPlaces(): Promise<Place[] | null> {
  const places = parsePlaces(await readJson<unknown>(CACHE_KEY));
  return places.length ? places : null;
}

/** Keep the list on the phone in the website's own row form (the smallest). */
export const cachePlaces = (places: Place[]) =>
  writeJson(CACHE_KEY, {
    places: places.map((p) => [p.name, p.state, p.lat, p.lng, p.population, p.station, p.altName]),
  });

export type PlacesState = 'idle' | 'loading' | 'ready' | 'offline';

// Loaded once per run of the app: every booking form after the first has it at once.
let memory: Place[] | null = null;
let pending: Promise<Place[] | null> | null = null;

async function loadOnce(url: string): Promise<Place[] | null> {
  const saved = await cachedPlaces();
  if (saved) memory = saved;
  const fresh = await fetchPlaces(url);
  if (fresh) {
    memory = fresh;
    void cachePlaces(fresh);
  }
  return memory;
}

/** Tests: forget what this run loaded. */
export function forgetPlaces() {
  memory = null;
  pending = null;
}

/**
 * The list for the place box: `load()` when the box is first used. `places`
 * is null until it is there; `state` says whether it is loading or could not
 * be had (offline: the curated destinations only).
 */
export function usePlaces(config: Pick<AppConfig, 'site'>): {
  places: Place[] | null;
  state: PlacesState;
  load: () => void;
} {
  const [places, setPlaces] = useState<Place[] | null>(memory);
  const [state, setState] = useState<PlacesState>(memory ? 'ready' : 'idle');
  const url = placesUrl(config);
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );

  const load = useCallback(() => {
    if (memory) {
      setPlaces(memory);
      setState('ready');
      return;
    }
    setState('loading');
    pending ??= loadOnce(url).finally(() => {
      pending = null;
    });
    void pending.then((list) => {
      if (!alive.current) return;
      setPlaces(list);
      setState(list ? 'ready' : 'offline');
    });
  }, [url]);

  return { places, state, load };
}

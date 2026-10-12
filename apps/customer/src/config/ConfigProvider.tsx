/**
 * Makes the price list and contact numbers available to every screen.
 *
 * Order of trust: the built-in copy (instant, works offline on first launch)
 * → the copy saved from the last successful download → a fresh download.
 * A fresh download is tried on launch and again whenever the app comes back to
 * the foreground after 30 minutes, so a price change reaches open apps too.
 */

import { type AppConfig, DEFAULT_CONFIG } from '@drivebuddy/shared';
import { type ReactNode, createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { cacheConfig, fetchRemoteConfig, loadCachedConfig } from './remote-config';

type Source = 'built-in' | 'saved' | 'live';
type ConfigState = { config: AppConfig; source: Source };

const ConfigContext = createContext<ConfigState>({ config: DEFAULT_CONFIG, source: 'built-in' });

const REFRESH_AFTER_MS = 30 * 60 * 1000;

export function ConfigProvider({ children, initial }: { children: ReactNode; initial?: AppConfig }) {
  const [state, setState] = useState<ConfigState>({ config: initial ?? DEFAULT_CONFIG, source: 'built-in' });
  const lastFetch = useRef(0);

  useEffect(() => {
    if (initial) return; // tests and previews pass a fixed config
    let alive = true;

    const refresh = async () => {
      lastFetch.current = Date.now();
      const live = await fetchRemoteConfig();
      if (!alive || !live) return;
      setState({ config: live, source: 'live' });
      void cacheConfig(live);
    };

    loadCachedConfig().then((saved) => {
      if (alive && saved) setState((s) => (s.source === 'live' ? s : { config: saved, source: 'saved' }));
    });
    void refresh();

    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && Date.now() - lastFetch.current > REFRESH_AFTER_MS) void refresh();
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, [initial]);

  const value = useMemo(() => state, [state]);
  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

export const useConfig = () => useContext(ConfigContext);

import {
  type City,
  RETRYABLE,
  type ReturnLookup,
  type ReturnOption,
  type TripPlan,
  findReturn,
  makeFetcher,
  railInputOf,
} from '@drivebuddy/shared';
import { useEffect, useMemo, useState } from 'react';

import { useConfig } from '@/config/ConfigProvider';

export type ReturnStatus = 'off' | 'loading' | 'ok' | 'none' | 'error';

export type ReturnTrains = {
  status: ReturnStatus;
  /** Still loading because the train service was busy: asking again shortly. */
  retrying: boolean;
  lookup?: ReturnLookup;
  /** The routes home, best first. */
  options: ReturnOption[];
  /** The one the estimate uses: the customer's choice, else the first. */
  selected?: ReturnOption;
  select: (id: string) => void;
};

/** Waits before asking again when the train service was busy or slow (as the website). */
const RETRY_DELAYS = [20_000, 45_000];

/**
 * The real trains home for a one-way drop, as on the website
 * (components/useReturnTrains.ts there): the robot's timetables for the
 * destination's stations, planned for when he drops the car (`startAt` +
 * the plan's drop time). Off for round trips, bus routes and when the lookup
 * is switched off in the website's settings.
 */
export function useReturnTrains(plan: TripPlan | null, city: City | '', startAt: number): ReturnTrains {
  const { config } = useConfig();
  const { lookupUrl, ...rules } = config.trains;
  const fetcher = useMemo(() => makeFetcher(lookupUrl), [lookupUrl]);
  const input =
    plan && lookupUrl ? railInputOf(plan, city, startAt, config.outstation.stationHours ?? 1) : undefined;
  const key = input ? `${input.stations.join('.')}+${input.hubs.join('.')}>${input.home}@${input.drop}` : '';
  const [result, setResult] = useState<{ key: string; lookup: ReturnLookup } | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [chosen, setChosen] = useState<{ key: string; id: string } | null>(null);

  useEffect(() => {
    if (!input) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const attempt = async (n: number) => {
      const lookup = await findReturn({ fetcher, ...input, now: Date.now(), rules });
      if (!alive) return;
      const errors = lookup.problems.flatMap((p) => (p.error ? [p.error] : []));
      const retry =
        lookup.status === 'error' && errors.length > 0 && errors.every((e) => RETRYABLE.includes(e));
      if (retry && n < RETRY_DELAYS.length) {
        setRetrying(key);
        timer = setTimeout(() => void attempt(n + 1), RETRY_DELAYS[n]);
        return;
      }
      setRetrying(null);
      setResult({ key, lookup });
    };
    // A short pause, so tapping through days and times does not ask for every step.
    timer = setTimeout(() => void attempt(0), 500);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // `input` and `rules` are fully described by `key` and the config.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, fetcher]);

  const lookup = result && result.key === key ? result.lookup : undefined;
  const options = lookup?.options ?? [];
  const selected = options.find((o) => o.id === (chosen?.key === key ? chosen.id : undefined)) ?? options[0];
  return {
    status: !input ? 'off' : !lookup ? 'loading' : lookup.status,
    retrying: Boolean(input) && !lookup && retrying === key,
    ...(lookup && { lookup }),
    options,
    ...(selected && { selected }),
    select: (id) => setChosen({ key, id }),
  };
}

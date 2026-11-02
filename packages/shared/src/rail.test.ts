import { DEFAULT_CONFIG, parseAppConfig } from './config';
import { findReturn, istInstant } from './rail';
import { makeFetcher } from './rail-client';
import { PICKUP_STATIONS, parseDestinations, planTrip, railInputOf, trainHours } from './trip';

/* The train home in the app: the same lookup as the website (rail.ts and
   rail-client.ts are copies of lib/rail.ts and lib/rail-client.ts there,
   tested in full in scripts/rail.test.mjs). Here: the app's side of it. */

const config = DEFAULT_CONFIG;

test('destinations carry their stations and change stations; bad codes reject the table', () => {
  const jbp = config.destinations.find((d) => d.id === 'jabalpur');
  expect(jbp?.rail).toEqual({ stations: ['JBP'], hubs: ['NGP', 'G'] });
  const row = (rail: unknown) => [{ ...config.destinations[0], rail }];
  expect(parseDestinations(row({ stations: ['NGP'] }))?.[0]?.rail).toEqual({ stations: ['NGP'], hubs: [] });
  expect(parseDestinations(row({ stations: ['ngp'] }))).toBeNull();
  expect(parseDestinations(row({ stations: [] }))).toBeNull();
  expect(parseDestinations(row({ stations: ['NGP'], hubs: ['X1'] }))).toBeNull();
});

test('the lookup settings: built in when the website file has none; only the robot’s address is accepted', () => {
  const file = (trains?: unknown) => ({
    ...JSON.parse(JSON.stringify({ ...config, tripsLive: undefined })),
    ...(trains !== undefined && { trains }),
  });
  expect(parseAppConfig(file())?.trains).toEqual(config.trains);
  expect(parseAppConfig(file({ ...config.trains, lookupUrl: '' }))?.trains.lookupUrl).toBe('');
  expect(parseAppConfig(file({ ...config.trains, lookupUrl: 'https://evil.example.com/x' }))).toBeNull();
  expect(parseAppConfig(file({ ...config.trains, maxOptions: 0 }))).toBeNull();
});

test('what to look up: one-way drops on a train route only, from the pickup city’s station', () => {
  const start = istInstant('2026-11-05', '07:00')!;
  const p = planTrip(config, 'one-way-drop', 'Bhilai', 'jabalpur', 0, { hour: 7, weekday: 4 });
  const input = railInputOf(p, 'Bhilai', start, 1)!;
  expect(input).toMatchObject({ stations: ['JBP'], hubs: ['NGP', 'G'], home: PICKUP_STATIONS.Bhilai });
  expect(input.drop).toBe(start + Math.round(p.dropAt! * 60) * 60_000);
  expect(input.ready - input.drop).toBe(3_600_000);
  expect(
    railInputOf(planTrip(config, 'outstation', 'Bhilai', 'jabalpur'), 'Bhilai', start, 1),
  ).toBeUndefined();
  expect(railInputOf(p, '', start, 1)).toBeUndefined();
});

test('the chosen train replaces the typical time home: the way home and the price follow it', () => {
  const start = istInstant('2026-11-05', '07:00')!;
  const typical = planTrip(config, 'one-way-drop', 'Raipur', 'nagpur', 0, { hour: 7, weekday: 4 });
  // Leaves 2 h after the drop, home 6 h after leaving.
  const train = { leaveAt: typical.dropAt! + 2, homeAt: typical.dropAt! + 8 };
  const p = planTrip(config, 'one-way-drop', 'Raipur', 'nagpur', 0, { hour: 7, weekday: 4 }, false, train);
  expect([p.leaveAt, p.homeAt, p.returnHours]).toEqual([train.leaveAt, train.homeAt, 8]);
  expect(p.dropAt).toBe(typical.dropAt);
  // A train before the drop is impossible: ignored.
  const before = planTrip(config, 'one-way-drop', 'Raipur', 'nagpur', 0, 7, false, { leaveAt: 1, homeAt: 5 });
  expect(before.homeAt).toBe(typical.homeAt);
  expect(trainHours({ depart: start + 3_600_000, arrive: start + 5 * 3_600_000 }, start)).toEqual({
    leaveAt: 1,
    homeAt: 5,
  });
});

test('no direct train soon enough: a route with one change through Nagpur, both trains from the lookup', async () => {
  const urls: string[] = [];
  const t = (number: string, dep: string, arr: string, arrDay: number, duration: number) => ({
    number,
    name: `Train ${number}`,
    type: 'Express',
    runDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
    dep,
    depDay: 1,
    arr,
    arrDay,
    duration,
    live: null,
  });
  const answers: Record<string, unknown[]> = {
    'JBP-R': [],
    'JBP-NGP': [t('12160', '19:00', '02:30', 2, 450)],
    'NGP-R': [t('12105', '05:30', '10:30', 1, 300)],
  };
  const fetchImpl = (async (url: string) => {
    urls.push(url);
    const q = decodeURIComponent(url.split('q=')[1]!.split('&')[0]!).split(',');
    return {
      ok: true,
      json: async () => ({
        ok: true,
        source: 'RailRadar',
        results: q.map((k) => ({
          q: k,
          ok: true,
          timetable: true,
          checkedAt: '2026-11-02T04:00:00.000Z',
          live: false,
          trains: answers[k] ?? [],
        })),
      }),
    };
  }) as unknown as typeof fetch;
  const drop = istInstant('2026-11-05', '15:00')!;
  const { lookupUrl, ...rules } = config.trains;
  const lookup = await findReturn({
    fetcher: makeFetcher(lookupUrl, { fetchImpl }),
    stations: ['JBP'],
    hubs: ['NGP'],
    home: 'R',
    drop,
    ready: drop + 3_600_000,
    now: drop - 3 * 86_400_000,
    rules,
  });
  expect(lookup.status).toBe('ok');
  expect(lookup.options[0]?.id.split('@')[0]).toBe('12160+12105');
  expect(lookup.options[0]?.transfer?.station.code).toBe('NGP');
  expect(urls).toHaveLength(2); // direct first, then the change: whole timetables, no dates
  expect(urls[1]).toContain(encodeURIComponent('JBP-NGP,NGP-R'));
});

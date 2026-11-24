/**
 * Every place in India for "Drop the car in" / "Where to?" — not only the
 * curated destinations (config.destinations). The same rules as the
 * website's lib/places.ts (24 Nov 2026).
 *
 * The list is the website's /data/india-places.json (3,502 places, all
 * states and union territories, by population; GeoNames CC BY 4.0, railway
 * stations from datameet CC0). The app downloads it when the place box is
 * first used and keeps the last good copy; it is never bundled. Without it
 * (offline, first use) the box searches the curated destinations only.
 *
 * A curated destination keeps its measured km, average way home and
 * stations. Any other place: km ≈ the straight line from the pickup city ×
 * outstation.roadFactor (the team confirms on the call); his way home — the
 * train from the place's nearest station when the lookup finds one, else the
 * bus/train average (stationHours, then the km at BUS_KMH).
 */

import type { City } from './catalog';
import type { AppConfig } from './config';
import type { CityLeg, TripDestination } from './trip';

/** One place: [name, state, lat, lng, population, station, altName] in the JSON. */
export type Place = {
  name: string;
  state: string;
  lat: number;
  lng: number;
  population: number;
  /** The nearest railway station's code (datameet), '' if none close by. */
  station: string;
  /** Old or other names, comma-separated ("Allahabad, Ilahabad" for Prayagraj). */
  altName: string;
};

/** Where the website serves the list (after its site url), when the config does not say. */
export const PLACES_PATH = '/data/india-places.json';

/** No road to these: a car cannot be driven there, so they are not offered. */
export const NO_ROAD_STATES: readonly string[] = ['Andaman and Nicobar Islands', 'Lakshadweep'];

/** The longest "Name, State" a booking can save (firestore.rules isTrip: to, 2–60 characters). */
export const LABEL_MAX = 60;

/** Road km ÷ straight-line km when the website does not send outstation.roadFactor (its setting: 1.3). */
export const DEFAULT_ROAD_FACTOR = 1.3;

/** His bus or train home from a place not in the list, km an hour with stops (the website's busKmh, 50). */
export const BUS_KMH = 50;

/** The pickup cities' points (the website's destinations), for the km to a place from the map. */
export const PICKUP_POINTS: Record<City, { lat: number; lng: number }> = {
  Raipur: { lat: 21.2514, lng: 81.6296 },
  Bhilai: { lat: 21.1938, lng: 81.3509 },
  Durg: { lat: 21.1904, lng: 81.2849 },
  Bilaspur: { lat: 22.0797, lng: 82.1409 },
};

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';

/**
 * The JSON → places, every row checked (a name, a state, a point in India, a
 * station code of capital letters or none); odd rows and places without a
 * road are left out. [] for anything that is not the list.
 */
export function parsePlaces(json: unknown): Place[] {
  const rows =
    json && typeof json === 'object' && Array.isArray((json as { places?: unknown }).places)
      ? (json as { places: unknown[] }).places
      : [];
  const out: Place[] = [];
  for (const r of rows) {
    if (!Array.isArray(r) || r.length < 7) continue;
    const [name, state, lat, lng, population, station, altName] = r as unknown[];
    if (!isStr(name) || !isStr(state) || !isNum(lat) || !isNum(lng) || !isStr(station) || !isStr(altName))
      continue;
    if (name.trim().length < 2 || !state || NO_ROAD_STATES.includes(state)) continue;
    if (lat < 6 || lat > 37 || lng < 68 || lng > 98) continue;
    if (station && !/^[A-Z]{1,5}$/.test(station)) continue;
    out.push({
      name: name.trim(),
      state,
      lat,
      lng,
      population: isNum(population) ? population : 0,
      station,
      altName,
    });
  }
  return out;
}

/** "Prayāgrāj" / "PRAYAGRAJ" / "prayag-raj" → "prayagraj" / "prayag raj": no accents or case, words by single spaces. */
export function plainText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** "Prayagraj, Uttar Pradesh" — what the booking saves as trip.to (at most LABEL_MAX characters). */
export function placeLabel(p: Pick<Place, 'name' | 'state'>): string {
  const full = `${p.name}, ${p.state}`;
  return full.length <= LABEL_MAX ? full : p.name.slice(0, LABEL_MAX);
}

/** Straight-line km between two points (haversine), as the website's airKm. */
export function airKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/**
 * One-way road km to a place not in the list: the straight line from the
 * pickup city × roadFactor (roads wind), to the km. Raipur → Ambikapur:
 * 263 km × 1.3 ≈ 342 km (measured: 334).
 */
export function placeKm(
  from: { lat: number; lng: number },
  place: { lat: number; lng: number },
  roadFactor: number,
): number {
  return Math.round(airKm(from, place) * roadFactor);
}

/** The website's road factor, or the default. */
export const roadFactorOf = (config: Pick<AppConfig, 'outstation'>): number =>
  config.outstation.roadFactor ?? DEFAULT_ROAD_FACTOR;

/** A result in the place box: one of the curated destinations, or a place from the list. */
export type PlaceEntry = {
  /** Curated: its measured km, way home and stations. */
  dest?: TripDestination;
  /** From the list: km from the map. */
  place?: Place;
  name: string;
  state: string;
  population: number;
  /** Searchable: the name, the other names and the state, plain. */
  keys: { name: string; alt: string[]; state: string };
};

const altNames = (alt: string) =>
  alt
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean);

/**
 * The search index: the curated destinations first (each with the state and
 * other names of the same place in the list), then every other place. A
 * place that is a curated one appears once, as curated.
 *
 * The website matches a curated destination to the list by its point (within
 * 40 km). The app's destination table has no points, so it matches by name
 * and by distance instead: of the places with that name, the one whose
 * map-estimated km from Raipur is closest to the measured km (within a
 * third, or 60 km) — Raipur in Chhattisgarh, not the Raipur in Rajasthan.
 */
export function placeIndex(places: readonly Place[], curated: readonly TripDestination[]): PlaceEntry[] {
  const taken = new Set<Place>();
  // Names without spaces, so "Raj-Nandgaon" is the curated Rajnandgaon.
  const squash = (x: string) => plainText(x).replace(/ /g, '');
  const plainNames = new Map(places.map((p) => [p, [squash(p.name), ...altNames(p.altName).map(squash)]]));
  const ours: PlaceEntry[] = curated.map((d) => {
    const n = squash(d.name);
    const measured = d.from.Raipur?.km ?? 0;
    let match: Place | undefined;
    let best = Math.max(60, measured / 3);
    for (const p of places) {
      if (taken.has(p) || !plainNames.get(p)?.includes(n)) continue;
      const off = Math.abs(placeKm(PICKUP_POINTS.Raipur, p, DEFAULT_ROAD_FACTOR) - measured);
      if (off < best) {
        best = off;
        match = p;
      }
    }
    if (match) taken.add(match);
    const state = match?.state ?? (d.region === 'cg' ? 'Chhattisgarh' : '');
    return {
      dest: d,
      name: d.name,
      state,
      population: match?.population ?? 0,
      keys: {
        name: plainText(d.name),
        alt: match
          ? [plainText(match.name), ...altNames(match.altName).map(plainText)].filter(
              (a) => a !== plainText(d.name),
            )
          : [],
        state: plainText(state),
      },
    };
  });
  const rest: PlaceEntry[] = places
    .filter((p) => !taken.has(p))
    .map((p) => ({
      place: p,
      name: p.name,
      state: p.state,
      population: p.population,
      keys: { name: plainText(p.name), alt: altNames(p.altName).map(plainText), state: plainText(p.state) },
    }));
  return [...ours, ...rest];
}

/** "navi mumbai east" → ["mumbai east", "east"]: the name from each word after the first. */
const laterWords = (n: string) => {
  const w = n.split(' ');
  return w.slice(1).map((_, i) => w.slice(i + 1).join(' '));
};

/**
 * How well `e` matches the plain query `q`: 0 its name (or another name)
 * begins with it, 1 a word of it does, 2 its state begins with it (typing a
 * state lists its places), 3 the query is inside a name; undefined: no match.
 */
function tier(e: PlaceEntry, q: string): number | undefined {
  const names = [e.keys.name, ...e.keys.alt];
  if (names.some((n) => n.startsWith(q))) return 0;
  if (names.some((n) => laterWords(n).some((rest) => rest.startsWith(q)))) return 1;
  if (q.length >= 3 && e.keys.state.startsWith(q)) return 2;
  if (q.length >= 3 && names.some((n) => n.includes(q))) return 3;
  return undefined;
}

/**
 * The places matching `query` (2 letters or more), best first: names that
 * begin with it, then a word that does, then the state's places, then the
 * names it is inside; within each, curated first, then the biggest. At most
 * `limit`.  "allahabad" → Prayagraj; "kochi" → Kochi; "kerala" → Kerala's places.
 */
export function searchPlaces(index: readonly PlaceEntry[], query: string, limit = 20): PlaceEntry[] {
  const q = plainText(query);
  if (q.length < 2) return [];
  const hits: { e: PlaceEntry; t: number; i: number }[] = [];
  index.forEach((e, i) => {
    const t = tier(e, q);
    if (t !== undefined) hits.push({ e, t, i });
  });
  hits.sort(
    (a, b) =>
      a.t - b.t || (a.e.dest ? 0 : 1) - (b.e.dest ? 0 : 1) || b.e.population - a.e.population || a.i - b.i,
  );
  return hits.slice(0, limit).map((h) => h.e);
}

/**
 * Station codes the timetables have renamed since the station list was made
 * (the train lookup asks with today's code) — the website's RENAMED_STATIONS.
 */
export const RENAMED_STATIONS: Readonly<Record<string, string>> = {
  ALD: 'PRYJ', //  Allahabad Jn → Prayagraj Jn
  ALY: 'PRRB', //  Allahabad City → Prayagraj Rambagh
  MGS: 'DDU', //   Mughal Sarai → Pt. Deen Dayal Upadhyaya Jn
  FD: 'AYC', //    Faizabad → Ayodhya Cantt
  HBJ: 'RKMP', //  Habibganj → Rani Kamlapati
  JHS: 'VGLB', //  Jhansi → Virangana Lakshmibai
  MUV: 'BSBS', //  Manduadih → Banaras
};

/** The place's station for the train lookup (today's code), or '' when it has none. */
export const placeStation = (p: Pick<Place, 'station'>): string =>
  p.station ? (RENAMED_STATIONS[p.station] ?? p.station) : '';

/** Within this many km (straight line) of the pickup city the place is the pickup city itself. */
const SAME_CITY_KM = 15;

/**
 * A place from the list as a destination for the planner (trip.ts planTrip)
 * and the train lookup — as the website's placeDestination: no id (it is not
 * a curated one: the booking saves destId ''), "Name, State" as its name
 * (saved as trip.to), from each pickup city the km from the map, the bus or
 * train home on the average (stationHours, then the km at BUS_KMH), and —
 * when it has a railway station nearby — that station for the trains home.
 */
export function placeDestination(config: Pick<AppConfig, 'outstation'>, place: Place): TripDestination {
  const label = placeLabel(place);
  const station = placeStation(place);
  const rules = config.outstation;
  const factor = roadFactorOf(config);
  const leg = (city: City): CityLeg => {
    const air = airKm(PICKUP_POINTS[city], place);
    const km = air < SAME_CITY_KM ? 0 : placeKm(PICKUP_POINTS[city], place, factor);
    const wait = rules.stationHours ?? 1;
    const homeHours = km / BUS_KMH;
    const driveHours = km / (rules.averageKmh ?? 50);
    // Round trips (the website's roundTripDays): there and back within sameDayMaxHours of driving is one day.
    const roundDays =
      (2 * km) / (rules.averageKmh ?? 50) <= (rules.sameDayMaxHours ?? 14) + 1e-9
        ? 1
        : Math.max(1, Math.ceil((2 * km) / rules.kmPerDay - 0.1));
    return {
      km,
      oneWay: {
        days: Math.max(1, Math.ceil(driveHours / rules.hoursPerDay - 1e-9)),
        returnHours: Math.max(0, Math.ceil(wait + homeHours - 1e-9)),
        driveHours,
        wait,
        homeHours,
      },
      roundDays,
    };
  };
  return {
    id: '',
    name: label,
    nameHi: label,
    region: place.state === 'Chhattisgarh' ? 'cg' : 'india',
    ...(station && { rail: { stations: [station], hubs: [] } }),
    from: { Raipur: leg('Raipur'), Bhilai: leg('Bhilai'), Durg: leg('Durg'), Bilaspur: leg('Bilaspur') },
  };
}

/**
 * Every place in India in the place box (places.ts): the same search, km and
 * saved trip as the website's lib/places.ts. The rows below are real rows of
 * the website's india-places.json.
 */

import { type AppConfig, DEFAULT_CONFIG } from './config';
import { DEFAULT_DESTINATIONS } from './destinations';
import {
  PICKUP_POINTS,
  type Place,
  parsePlaces,
  placeDestination,
  placeIndex,
  placeKm,
  placeLabel,
  placeStation,
  plainText,
  searchPlaces,
} from './places';
import { planTrip, tripRecord } from './trip';

const ROWS = [
  ['Nagpur', 'Maharashtra', 21.1463, 79.0849, 2228018, 'NGPB', ''],
  ['Varanasi', 'Uttar Pradesh', 25.3167, 83.0104, 1164404, 'BCY', 'Banaras, Benares, Kashi'],
  ['Prayagraj', 'Uttar Pradesh', 25.4448, 81.8432, 1073438, 'ALY', 'Allahabad, Ilahabad'],
  ['Ranchi', 'Jharkhand', 23.3432, 85.3094, 846454, 'RNC', ''],
  ['Thiruvananthapuram', 'Kerala', 8.4855, 76.9492, 784153, 'TVC', 'Trivandrum'],
  ['Raipur', 'Chhattisgarh', 21.2333, 81.6333, 679995, 'R', ''],
  ['Kochi', 'Kerala', 9.9399, 76.2602, 604696, 'ERS', 'Cochin, Ernakulam'],
  ['Kozhikode', 'Kerala', 11.248, 75.7804, 439922, 'CLT', ''],
  ['Koch Bihar', 'West Bengal', 26.3254, 89.4451, 78737, 'NCB', ''],
  ['Ambikapur', 'Chhattisgarh', 23.1189, 83.1954, 72821, 'ABKP', ''],
  ['Raipur', 'Uttarakhand', 30.311, 78.0898, 27702, 'DDN', ''],
  ['Raipur', 'Rajasthan', 26.0426, 74.0237, 17537, 'HP', ''],
  ['Navi Mumbai', 'Maharashtra', 19.0368, 73.0158, 1119477, 'NRL', ''],
];
const PLACES = parsePlaces({ fields: [], places: ROWS });
const INDEX = placeIndex(PLACES, DEFAULT_DESTINATIONS);
const names = (q: string, limit?: number) =>
  searchPlaces(INDEX, q, limit).map((e) => `${e.name}${e.dest ? '*' : ''}, ${e.state}`);
const byName = (n: string) => PLACES.find((p) => p.name === n) as Place;

describe('the list', () => {
  test('rows are checked; islands without a road and odd rows are left out', () => {
    expect(PLACES).toHaveLength(ROWS.length);
    expect(
      parsePlaces({
        places: [
          ['Port Blair', 'Andaman and Nicobar Islands', 11.67, 92.74, 100608, 'PBL', ''],
          ['X', 'Kerala', 9, 76, 1, '', ''], // too short
          ['London', 'England', 51.5, -0.1, 1, '', ''], // not in India
          ['Kochi', 'Kerala', 9.9, 76.2, 1, 'ers', ''], // odd station code
          ['Kochi', 'Kerala', '9.9', 76.2, 1, '', ''],
          'nonsense',
        ],
      }),
    ).toEqual([]);
    expect(parsePlaces('nope')).toEqual([]);
    expect(parsePlaces({ places: [['Kochi', 'Kerala', 9.94, 76.26, null, '', '']] })[0]?.population).toBe(0);
  });

  test('plain text: no accents, case or punctuation', () => {
    expect(plainText('Prayāgrāj')).toBe('prayagraj');
    expect(plainText('  PRAYAG-raj ')).toBe('prayag raj');
  });
});

describe('the search', () => {
  test('an old name finds today’s place: Allahabad → Prayagraj (one of ours)', () => {
    expect(names('allahabad')[0]).toBe('Prayagraj*, Uttar Pradesh');
    expect(names('Ilahabad')[0]).toBe('Prayagraj*, Uttar Pradesh');
    expect(names('cochin')[0]).toBe('Kochi, Kerala');
    expect(names('trivandrum')[0]).toBe('Thiruvananthapuram, Kerala');
  });

  test('"kochi" is Kochi, not Koch Bihar; accents and case do not matter', () => {
    expect(names('kochi')).toEqual(['Kochi, Kerala']);
    expect(names('KOCH')[0]).toBe('Kochi, Kerala'); // the bigger first
    expect(names('Prayāgrāj')[0]).toBe('Prayagraj*, Uttar Pradesh');
  });

  test('a state lists its places, biggest first', () => {
    expect(names('Kerala')).toEqual(['Thiruvananthapuram, Kerala', 'Kochi, Kerala', 'Kozhikode, Kerala']);
  });

  test('ours first among equals, then by population; a later word; at most the limit', () => {
    const ra = searchPlaces(INDEX, 'rai');
    const firstPlace = ra.findIndex((e) => !e.dest);
    expect(ra.slice(0, firstPlace).every((e) => e.dest)).toBe(true);
    expect(ra.slice(firstPlace).every((e) => !e.dest)).toBe(true);
    expect(names('mumbai')).toContain('Navi Mumbai, Maharashtra'); // "Navi Mumbai": a later word
    expect(searchPlaces(INDEX, 'a', 20)).toEqual([]); // two letters at least
    expect(searchPlaces(INDEX, 'ra', 5)).toHaveLength(5);
  });

  test('a curated destination is matched to its own row: Raipur is in Chhattisgarh, once', () => {
    const raipur = searchPlaces(INDEX, 'raipur').filter((e) => e.name === 'Raipur');
    expect(raipur[0]).toMatchObject({ state: 'Chhattisgarh', population: 679995 });
    expect(raipur[0]?.dest?.id).toBe('raipur');
    // The other two Raipurs stay places of their own.
    expect(raipur.slice(1).map((e) => e.state)).toEqual(['Uttarakhand', 'Rajasthan']);
    expect(INDEX.find((e) => e.dest?.id === 'ranchi')?.state).toBe('Jharkhand');
  });

  test('offline (no list): the curated destinations only', () => {
    const offline = placeIndex([], DEFAULT_DESTINATIONS);
    expect(searchPlaces(offline, 'kochi')).toEqual([]);
    expect(searchPlaces(offline, 'ranchi')[0]?.dest?.id).toBe('ranchi');
  });
});

describe('a place not among ours', () => {
  const CONFIG: AppConfig = {
    ...DEFAULT_CONFIG,
    outstation: {
      ...DEFAULT_CONFIG.outstation,
      roadFactor: 1.3,
      oneWay: { perKm: 3, homeHour: 100, homeDayMax: 1500, minimum: 1500, roundTo: 50 },
    },
  };

  test('km = the straight line from the pickup city × roadFactor: Raipur → Ambikapur 342 km (measured 334)', () => {
    expect(placeKm(PICKUP_POINTS.Raipur, byName('Ambikapur'), 1.3)).toBe(342);
    expect(placeKm(PICKUP_POINTS.Raipur, byName('Kochi'), 1.3)).toBe(1797);
    // No roadFactor from the website: 1.3.
    expect(placeDestination(DEFAULT_CONFIG, byName('Kochi')).from.Raipur.km).toBe(1797);
    expect(
      placeDestination({ outstation: { ...CONFIG.outstation, roadFactor: 1.25 } }, byName('Kochi')).from
        .Raipur.km,
    ).toBe(1728);
  });

  test('as a destination: "Name, State", no id, its station (renamed codes mapped), the average way home', () => {
    const kochi = placeDestination(CONFIG, byName('Kochi'));
    expect(kochi).toMatchObject({
      id: '',
      name: 'Kochi, Kerala',
      region: 'india',
      rail: { stations: ['ERS'], hubs: [] },
    });
    expect(kochi.from.Raipur.oneWay).toMatchObject({ wait: 1 });
    expect(kochi.from.Raipur.oneWay.homeHours).toBeCloseTo(1797 / 50, 5);
    expect(placeStation(byName('Prayagraj'))).toBe('PRRB'); // ALY → Prayagraj Rambagh
    expect(placeStation({ station: '' })).toBe('');
    expect(placeLabel({ name: 'A'.repeat(70), state: 'Kerala' })).toHaveLength(60);
    // The pickup city itself (within 15 km).
    expect(placeDestination(CONFIG, byName('Raipur')).from.Raipur.km).toBe(0);
  });

  test('priced from its km and saved as the website saves it', () => {
    const dest = placeDestination(CONFIG, byName('Kochi'));
    const plan = planTrip(CONFIG, 'one-way-drop', 'Raipur', dest);
    // 1,797 km × ₹3 = 5,391 + his way home 1 h + 35 h 56 m on the bus → 36 h 56 m: ₹1,500 + 13 h × ₹100.
    expect(plan.est?.byKm).toMatchObject({ km: 1797, driving: 5391, home: 2800 });
    expect(plan.est?.from).toBe(8200);
    expect(tripRecord(plan, '')).toEqual({
      to: 'Kochi, Kerala',
      destId: '',
      kind: 'one-way',
      km: 1797,
      days: plan.days,
      returnHours: plan.returnHours,
      estFrom: 8200,
      estTo: 8200,
    });
    // A round trip there: the days at the day price for the distance.
    const round = planTrip(CONFIG, 'outstation', 'Raipur', dest);
    expect(round.est?.days).toBe(dest.from.Raipur.roundDays);
    expect(round.est?.from).toBeGreaterThan(0);
  });
});

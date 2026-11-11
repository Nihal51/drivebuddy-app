/**
 * The destinations table as the website published it on 2026-11-08 (generated from
 * lib/outstation.ts there — do not edit by hand). Only a fallback: the app uses
 * the live table from /app-config.json whenever it has one.
 */

import type { TripDestination } from './trip';

export const DEFAULT_DESTINATIONS: TripDestination[] = [
  {
    id: 'raipur',
    name: 'Raipur',
    nameHi: 'रायपुर',
    region: 'cg',
    from: {
      Raipur: {
        km: 0,
        oneWay: { days: 1, returnHours: 0, driveHours: 0, wait: 1, homeHours: 0 },
        roundDays: 1,
      },
      Bhilai: {
        km: 30,
        oneWay: { days: 1, returnHours: 2, driveHours: 0.6, wait: 1, homeHours: 0.75 },
        roundDays: 1,
      },
      Durg: {
        km: 40,
        oneWay: { days: 1, returnHours: 2, driveHours: 0.8, wait: 1, homeHours: 0.75 },
        roundDays: 1,
      },
      Bilaspur: {
        km: 110,
        oneWay: { days: 1, returnHours: 3, driveHours: 2.2, wait: 1, homeHours: 1.5 },
        roundDays: 1,
      },
    },
  },
  {
    id: 'bhilai',
    name: 'Bhilai',
    nameHi: 'भिलाई',
    region: 'cg',
    from: {
      Raipur: {
        km: 33,
        oneWay: { days: 1, returnHours: 2, driveHours: 0.66, wait: 1, homeHours: 0.75 },
        roundDays: 1,
      },
      Bhilai: {
        km: 0,
        oneWay: { days: 1, returnHours: 0, driveHours: 0, wait: 1, homeHours: 0.3 },
        roundDays: 1,
      },
      Durg: {
        km: 10,
        oneWay: { days: 1, returnHours: 2, driveHours: 0.2, wait: 1, homeHours: 0.3 },
        roundDays: 1,
      },
      Bilaspur: {
        km: 140,
        oneWay: { days: 1, returnHours: 4, driveHours: 2.8, wait: 1, homeHours: 2.75 },
        roundDays: 1,
      },
    },
  },
  {
    id: 'durg',
    name: 'Durg',
    nameHi: 'दुर्ग',
    region: 'cg',
    from: {
      Raipur: {
        km: 40,
        oneWay: { days: 1, returnHours: 2, driveHours: 0.8, wait: 1, homeHours: 0.75 },
        roundDays: 1,
      },
      Bhilai: {
        km: 10,
        oneWay: { days: 1, returnHours: 2, driveHours: 0.2, wait: 1, homeHours: 0.2 },
        roundDays: 1,
      },
      Durg: {
        km: 0,
        oneWay: { days: 1, returnHours: 0, driveHours: 0, wait: 1, homeHours: 0 },
        roundDays: 1,
      },
      Bilaspur: {
        km: 150,
        oneWay: { days: 1, returnHours: 4, driveHours: 3, wait: 1, homeHours: 2.75 },
        roundDays: 1,
      },
    },
  },
  {
    id: 'mahasamund',
    name: 'Mahasamund',
    nameHi: 'महासमुंद',
    region: 'cg',
    from: {
      Raipur: {
        km: 55,
        oneWay: { days: 1, returnHours: 3, driveHours: 1.1, wait: 1.5, homeHours: 1.5 },
        roundDays: 1,
      },
      Bhilai: {
        km: 80,
        oneWay: { days: 1, returnHours: 4, driveHours: 1.6, wait: 1.5, homeHours: 2.5 },
        roundDays: 1,
      },
      Durg: {
        km: 90,
        oneWay: { days: 1, returnHours: 4, driveHours: 1.8, wait: 1.5, homeHours: 2.5 },
        roundDays: 1,
      },
      Bilaspur: {
        km: 120,
        oneWay: { days: 1, returnHours: 5, driveHours: 2.4, wait: 1.5, homeHours: 3.5 },
        roundDays: 1,
      },
    },
  },
  {
    id: 'dhamtari',
    name: 'Dhamtari',
    nameHi: 'धमतरी',
    region: 'cg',
    from: {
      Raipur: {
        km: 67,
        oneWay: { days: 1, returnHours: 4, driveHours: 1.34, wait: 1.5, homeHours: 2 },
        roundDays: 1,
      },
      Bhilai: {
        km: 60,
        oneWay: { days: 1, returnHours: 4, driveHours: 1.2, wait: 1.5, homeHours: 2.25 },
        roundDays: 1,
      },
      Durg: {
        km: 70,
        oneWay: { days: 1, returnHours: 4, driveHours: 1.4, wait: 1.5, homeHours: 2.25 },
        roundDays: 1,
      },
      Bilaspur: {
        km: 180,
        oneWay: { days: 1, returnHours: 6, driveHours: 3.6, wait: 1.5, homeHours: 4 },
        roundDays: 1,
      },
    },
  },
  {
    id: 'rajnandgaon',
    name: 'Rajnandgaon',
    nameHi: 'राजनांदगांव',
    region: 'cg',
    rail: { stations: ['RJN'], hubs: [] },
    from: {
      Raipur: {
        km: 74,
        oneWay: { days: 1, returnHours: 3, driveHours: 1.48, wait: 1, homeHours: 1.5 },
        roundDays: 1,
      },
      Bhilai: {
        km: 40,
        oneWay: { days: 1, returnHours: 2, driveHours: 0.8, wait: 1, homeHours: 0.75 },
        roundDays: 1,
      },
      Durg: {
        km: 30,
        oneWay: { days: 1, returnHours: 2, driveHours: 0.6, wait: 1, homeHours: 0.75 },
        roundDays: 1,
      },
      Bilaspur: {
        km: 180,
        oneWay: { days: 1, returnHours: 4, driveHours: 3.6, wait: 1, homeHours: 3 },
        roundDays: 1,
      },
    },
  },
  {
    id: 'dongargarh',
    name: 'Dongargarh',
    nameHi: 'डोंगरगढ़',
    region: 'cg',
    rail: { stations: ['DGG'], hubs: [] },
    from: {
      Raipur: {
        km: 108,
        oneWay: { days: 1, returnHours: 3, driveHours: 2.16, wait: 1, homeHours: 2 },
        roundDays: 1,
      },
      Bhilai: {
        km: 70,
        oneWay: { days: 1, returnHours: 3, driveHours: 1.4, wait: 1, homeHours: 1.25 },
        roundDays: 1,
      },
      Durg: {
        km: 70,
        oneWay: { days: 1, returnHours: 3, driveHours: 1.4, wait: 1, homeHours: 1.25 },
        roundDays: 1,
      },
      Bilaspur: {
        km: 210,
        oneWay: { days: 1, returnHours: 5, driveHours: 4.2, wait: 1, homeHours: 3.75 },
        roundDays: 1,
      },
    },
  },
  {
    id: 'bilaspur',
    name: 'Bilaspur',
    nameHi: 'बिलासपुर',
    region: 'cg',
    rail: { stations: ['BSP'], hubs: [] },
    from: {
      Raipur: {
        km: 113,
        oneWay: { days: 1, returnHours: 4, driveHours: 2.26, wait: 2, homeHours: 1.5 },
        roundDays: 1,
      },
      Bhilai: {
        km: 140,
        oneWay: { days: 1, returnHours: 5, driveHours: 2.8, wait: 2, homeHours: 2.5 },
        roundDays: 1,
      },
      Durg: {
        km: 140,
        oneWay: { days: 1, returnHours: 5, driveHours: 2.8, wait: 2, homeHours: 2.5 },
        roundDays: 1,
      },
      Bilaspur: {
        km: 0,
        oneWay: { days: 1, returnHours: 0, driveHours: 0, wait: 2, homeHours: 0 },
        roundDays: 1,
      },
    },
  },
  {
    id: 'kawardha',
    name: 'Kawardha',
    nameHi: 'कवर्धा',
    region: 'cg',
    from: {
      Raipur: {
        km: 116,
        oneWay: { days: 1, returnHours: 5, driveHours: 2.32, wait: 1.5, homeHours: 3 },
        roundDays: 1,
      },
      Bhilai: {
        km: 110,
        oneWay: { days: 1, returnHours: 5, driveHours: 2.2, wait: 1.5, homeHours: 2.75 },
        roundDays: 1,
      },
      Durg: {
        km: 110,
        oneWay: { days: 1, returnHours: 5, driveHours: 2.2, wait: 1.5, homeHours: 2.75 },
        roundDays: 1,
      },
      Bilaspur: {
        km: 120,
        oneWay: { days: 1, returnHours: 5, driveHours: 2.4, wait: 1.5, homeHours: 3.25 },
        roundDays: 1,
      },
    },
  },
  {
    id: 'kanker',
    name: 'Kanker',
    nameHi: 'कांकेर',
    region: 'cg',
    from: {
      Raipur: {
        km: 127,
        oneWay: { days: 1, returnHours: 5, driveHours: 2.54, wait: 1.5, homeHours: 3.5 },
        roundDays: 1,
      },
      Bhilai: {
        km: 120,
        oneWay: { days: 1, returnHours: 6, driveHours: 2.4, wait: 1.5, homeHours: 3.75 },
        roundDays: 1,
      },
      Durg: {
        km: 120,
        oneWay: { days: 1, returnHours: 6, driveHours: 2.4, wait: 1.5, homeHours: 3.75 },
        roundDays: 1,
      },
      Bilaspur: {
        km: 240,
        oneWay: { days: 1, returnHours: 7, driveHours: 4.8, wait: 1.5, homeHours: 5.5 },
        roundDays: 1,
      },
    },
  },
  {
    id: 'janjgir',
    name: 'Janjgir',
    nameHi: 'जांजगीर',
    region: 'cg',
    rail: { stations: ['NIA'], hubs: [] },
    from: {
      Raipur: {
        km: 160,
        oneWay: { days: 1, returnHours: 7, driveHours: 3.2, wait: 3.25, homeHours: 3 },
        roundDays: 1,
      },
      Bhilai: {
        km: 190,
        oneWay: { days: 1, returnHours: 7, driveHours: 3.8, wait: 3.25, homeHours: 3.5 },
        roundDays: 1,
      },
      Durg: {
        km: 200,
        oneWay: { days: 1, returnHours: 7, driveHours: 4, wait: 3.25, homeHours: 3.5 },
        roundDays: 1,
      },
      Bilaspur: {
        km: 60,
        oneWay: { days: 1, returnHours: 5, driveHours: 1.2, wait: 3.25, homeHours: 1 },
        roundDays: 1,
      },
    },
  },
  {
    id: 'amarkantak',
    name: 'Amarkantak',
    nameHi: 'अमरकंटक',
    region: 'cg',
    from: {
      Raipur: {
        km: 209,
        oneWay: { days: 1, returnHours: 7, driveHours: 4.18, wait: 1.5, homeHours: 5.5 },
        roundDays: 1,
      },
      Bhilai: {
        km: 220,
        oneWay: { days: 1, returnHours: 8, driveHours: 4.4, wait: 1.5, homeHours: 6.5 },
        roundDays: 1,
      },
      Durg: {
        km: 220,
        oneWay: { days: 1, returnHours: 8, driveHours: 4.4, wait: 1.5, homeHours: 6.5 },
        roundDays: 1,
      },
      Bilaspur: {
        km: 100,
        oneWay: { days: 1, returnHours: 5, driveHours: 2, wait: 1.5, homeHours: 3 },
        roundDays: 1,
      },
    },
  },
  {
    id: 'korba',
    name: 'Korba',
    nameHi: 'कोरबा',
    region: 'cg',
    rail: { stations: ['KRBA'], hubs: [] },
    from: {
      Raipur: {
        km: 216,
        oneWay: { days: 1, returnHours: 9, driveHours: 4.32, wait: 4.75, homeHours: 4 },
        roundDays: 1,
      },
      Bhilai: {
        km: 250,
        oneWay: { days: 1, returnHours: 10, driveHours: 5, wait: 4.75, homeHours: 4.75 },
        roundDays: 1,
      },
      Durg: {
        km: 250,
        oneWay: { days: 1, returnHours: 10, driveHours: 5, wait: 4.75, homeHours: 4.75 },
        roundDays: 1,
      },
      Bilaspur: {
        km: 90,
        oneWay: { days: 1, returnHours: 7, driveHours: 1.8, wait: 4.75, homeHours: 2 },
        roundDays: 1,
      },
    },
  },
  {
    id: 'raigarh',
    name: 'Raigarh',
    nameHi: 'रायगढ़',
    region: 'cg',
    rail: { stations: ['RIG'], hubs: [] },
    from: {
      Raipur: {
        km: 258,
        oneWay: { days: 1, returnHours: 8, driveHours: 5.16, wait: 3, homeHours: 4.25 },
        roundDays: 1,
      },
      Bhilai: {
        km: 290,
        oneWay: { days: 1, returnHours: 8, driveHours: 5.8, wait: 3, homeHours: 4.75 },
        roundDays: 1,
      },
      Durg: {
        km: 300,
        oneWay: { days: 1, returnHours: 8, driveHours: 6, wait: 3, homeHours: 4.75 },
        roundDays: 1,
      },
      Bilaspur: {
        km: 170,
        oneWay: { days: 1, returnHours: 6, driveHours: 3.4, wait: 3, homeHours: 2.5 },
        roundDays: 1,
      },
    },
  },
  {
    id: 'jagdalpur',
    name: 'Jagdalpur',
    nameHi: 'जगदलपुर',
    region: 'cg',
    from: {
      Raipur: {
        km: 287,
        oneWay: { days: 1, returnHours: 9, driveHours: 5.74, wait: 1.5, homeHours: 7 },
        roundDays: 1,
      },
      Bhilai: {
        km: 290,
        oneWay: { days: 1, returnHours: 10, driveHours: 5.8, wait: 1.5, homeHours: 8 },
        roundDays: 1,
      },
      Durg: {
        km: 290,
        oneWay: { days: 1, returnHours: 10, driveHours: 5.8, wait: 1.5, homeHours: 8 },
        roundDays: 1,
      },
      Bilaspur: {
        km: 390,
        oneWay: { days: 1, returnHours: 11, driveHours: 7.8, wait: 1.5, homeHours: 9 },
        roundDays: 2,
      },
    },
  },
  {
    id: 'ambikapur',
    name: 'Ambikapur',
    nameHi: 'अंबिकापुर',
    region: 'cg',
    from: {
      Raipur: {
        km: 334,
        oneWay: { days: 1, returnHours: 9, driveHours: 6.68, wait: 1.5, homeHours: 7.5 },
        roundDays: 1,
      },
      Bhilai: {
        km: 360,
        oneWay: { days: 1, returnHours: 10, driveHours: 7.2, wait: 1.5, homeHours: 8.5 },
        roundDays: 2,
      },
      Durg: {
        km: 370,
        oneWay: { days: 1, returnHours: 10, driveHours: 7.4, wait: 1.5, homeHours: 8.5 },
        roundDays: 2,
      },
      Bilaspur: {
        km: 200,
        oneWay: { days: 1, returnHours: 7, driveHours: 4, wait: 1.5, homeHours: 5.25 },
        roundDays: 1,
      },
    },
  },
  {
    id: 'gondia',
    name: 'Gondia',
    nameHi: 'गोंदिया',
    region: 'india',
    rail: { stations: ['G'], hubs: [] },
    from: {
      Raipur: {
        km: 201,
        oneWay: { days: 1, returnHours: 6, driveHours: 4.02, wait: 2, homeHours: 3.25 },
        roundDays: 1,
      },
      Bhilai: {
        km: 170,
        oneWay: { days: 1, returnHours: 5, driveHours: 3.4, wait: 2, homeHours: 2.5 },
        roundDays: 1,
      },
      Durg: {
        km: 160,
        oneWay: { days: 1, returnHours: 5, driveHours: 3.2, wait: 2, homeHours: 2.5 },
        roundDays: 1,
      },
      Bilaspur: {
        km: 290,
        oneWay: { days: 1, returnHours: 7, driveHours: 5.8, wait: 2, homeHours: 4.75 },
        roundDays: 1,
      },
    },
  },
  {
    id: 'sambalpur',
    name: 'Sambalpur',
    nameHi: 'संबलपुर',
    region: 'india',
    from: {
      Raipur: {
        km: 275,
        oneWay: { days: 1, returnHours: 8, driveHours: 5.5, wait: 1.5, homeHours: 6 },
        roundDays: 1,
      },
      Bhilai: {
        km: 310,
        oneWay: { days: 1, returnHours: 8, driveHours: 6.2, wait: 1.5, homeHours: 6.5 },
        roundDays: 1,
      },
      Durg: {
        km: 320,
        oneWay: { days: 1, returnHours: 8, driveHours: 6.4, wait: 1.5, homeHours: 6.5 },
        roundDays: 1,
      },
      Bilaspur: {
        km: 230,
        oneWay: { days: 1, returnHours: 6, driveHours: 4.6, wait: 1.5, homeHours: 4.5 },
        roundDays: 1,
      },
    },
  },
  {
    id: 'nagpur',
    name: 'Nagpur',
    nameHi: 'नागपुर',
    region: 'india',
    rail: { stations: ['NGP'], hubs: [] },
    from: {
      Raipur: {
        km: 284,
        oneWay: { days: 1, returnHours: 8, driveHours: 5.68, wait: 2.5, homeHours: 4.75 },
        roundDays: 1,
      },
      Bhilai: {
        km: 250,
        oneWay: { days: 1, returnHours: 7, driveHours: 5, wait: 2.5, homeHours: 4 },
        roundDays: 1,
      },
      Durg: {
        km: 250,
        oneWay: { days: 1, returnHours: 7, driveHours: 5, wait: 2.5, homeHours: 4 },
        roundDays: 1,
      },
      Bilaspur: {
        km: 360,
        oneWay: { days: 1, returnHours: 9, driveHours: 7.2, wait: 2.5, homeHours: 6.25 },
        roundDays: 2,
      },
    },
  },
  {
    id: 'jharsuguda',
    name: 'Jharsuguda',
    nameHi: 'झारसुगुड़ा',
    region: 'india',
    rail: { stations: ['JSG'], hubs: [] },
    from: {
      Raipur: {
        km: 320,
        oneWay: { days: 1, returnHours: 9, driveHours: 6.4, wait: 3, homeHours: 5.25 },
        roundDays: 1,
      },
      Bhilai: {
        km: 350,
        oneWay: { days: 1, returnHours: 10, driveHours: 7, wait: 3, homeHours: 6.25 },
        roundDays: 1,
      },
      Durg: {
        km: 360,
        oneWay: { days: 1, returnHours: 10, driveHours: 7.2, wait: 3, homeHours: 6.25 },
        roundDays: 2,
      },
      Bilaspur: {
        km: 240,
        oneWay: { days: 1, returnHours: 7, driveHours: 4.8, wait: 3, homeHours: 3.5 },
        roundDays: 1,
      },
    },
  },
  {
    id: 'jabalpur',
    name: 'Jabalpur',
    nameHi: 'जबलपुर',
    region: 'india',
    rail: { stations: ['JBP'], hubs: ['NGP', 'G'] },
    from: {
      Raipur: {
        km: 383,
        oneWay: { days: 1, returnHours: 16, driveHours: 7.66, wait: 7.25, homeHours: 8.75 },
        roundDays: 2,
      },
      Bhilai: {
        km: 370,
        oneWay: { days: 1, returnHours: 16, driveHours: 7.4, wait: 7.25, homeHours: 8.25 },
        roundDays: 2,
      },
      Durg: {
        km: 360,
        oneWay: { days: 1, returnHours: 16, driveHours: 7.2, wait: 7.25, homeHours: 8.25 },
        roundDays: 2,
      },
      Bilaspur: {
        km: 350,
        oneWay: { days: 1, returnHours: 16, driveHours: 7, wait: 7.25, homeHours: 8.25 },
        roundDays: 1,
      },
    },
  },
  {
    id: 'visakhapatnam',
    name: 'Visakhapatnam',
    nameHi: 'विशाखापत्तनम',
    region: 'india',
    rail: { stations: ['VSKP'], hubs: [] },
    from: {
      Raipur: {
        km: 546,
        oneWay: { days: 1, returnHours: 15, driveHours: 10.92, wait: 4.75, homeHours: 9.5 },
        roundDays: 2,
      },
      Bhilai: {
        km: 550,
        oneWay: { days: 1, returnHours: 16, driveHours: 11, wait: 4.75, homeHours: 10.5 },
        roundDays: 2,
      },
      Durg: {
        km: 560,
        oneWay: { days: 1, returnHours: 16, driveHours: 11.2, wait: 4.75, homeHours: 10.5 },
        roundDays: 2,
      },
      Bilaspur: {
        km: 640,
        oneWay: { days: 1, returnHours: 17, driveHours: 12.8, wait: 4.75, homeHours: 11.5 },
        roundDays: 3,
      },
    },
  },
  {
    id: 'bhubaneswar',
    name: 'Bhubaneswar',
    nameHi: 'भुवनेश्वर',
    region: 'india',
    rail: { stations: ['BBS'], hubs: [] },
    from: {
      Raipur: {
        km: 547,
        oneWay: { days: 1, returnHours: 22, driveHours: 10.94, wait: 8.5, homeHours: 13 },
        roundDays: 2,
      },
      Bhilai: {
        km: 580,
        oneWay: { days: 1, returnHours: 23, driveHours: 11.6, wait: 8.5, homeHours: 13.75 },
        roundDays: 2,
      },
      Durg: {
        km: 590,
        oneWay: { days: 1, returnHours: 23, driveHours: 11.8, wait: 8.5, homeHours: 13.75 },
        roundDays: 2,
      },
      Bilaspur: {
        km: 520,
        oneWay: { days: 1, returnHours: 24, driveHours: 10.4, wait: 8.5, homeHours: 15 },
        roundDays: 2,
      },
    },
  },
  {
    id: 'puri',
    name: 'Puri',
    nameHi: 'पुरी',
    region: 'india',
    rail: { stations: ['PURI'], hubs: [] },
    from: {
      Raipur: {
        km: 577,
        oneWay: { days: 1, returnHours: 24, driveHours: 11.54, wait: 8.5, homeHours: 14.75 },
        roundDays: 2,
      },
      Bhilai: {
        km: 610,
        oneWay: { days: 1, returnHours: 24, driveHours: 12.2, wait: 8.5, homeHours: 15.5 },
        roundDays: 2,
      },
      Durg: {
        km: 620,
        oneWay: { days: 1, returnHours: 24, driveHours: 12.4, wait: 8.5, homeHours: 15.5 },
        roundDays: 2,
      },
      Bilaspur: {
        km: 570,
        oneWay: { days: 1, returnHours: 26, driveHours: 11.4, wait: 8.5, homeHours: 16.75 },
        roundDays: 2,
      },
    },
  },
  {
    id: 'prayagraj',
    name: 'Prayagraj',
    nameHi: 'प्रयागराज',
    region: 'india',
    rail: { stations: ['PRYJ', 'PCOI'], hubs: ['NGP'] },
    from: {
      Raipur: {
        km: 578,
        oneWay: { days: 1, returnHours: 21, driveHours: 11.56, wait: 6.5, homeHours: 13.75 },
        roundDays: 2,
      },
      Bhilai: {
        km: 590,
        oneWay: { days: 1, returnHours: 22, driveHours: 11.8, wait: 6.5, homeHours: 14.75 },
        roundDays: 2,
      },
      Durg: {
        km: 590,
        oneWay: { days: 1, returnHours: 22, driveHours: 11.8, wait: 6.5, homeHours: 14.75 },
        roundDays: 2,
      },
      Bilaspur: {
        km: 460,
        oneWay: { days: 1, returnHours: 19, driveHours: 9.2, wait: 6.5, homeHours: 11.75 },
        roundDays: 2,
      },
    },
  },
  {
    id: 'ranchi',
    name: 'Ranchi',
    nameHi: 'रांची',
    region: 'india',
    rail: { stations: ['RNC', 'HTE'], hubs: [] },
    from: {
      Raipur: {
        km: 616,
        oneWay: { days: 1, returnHours: 21, driveHours: 12.32, wait: 10.75, homeHours: 10 },
        roundDays: 2,
      },
      Bhilai: {
        km: 650,
        oneWay: { days: 1, returnHours: 22, driveHours: 13, wait: 10.75, homeHours: 10.5 },
        roundDays: 3,
      },
      Durg: {
        km: 660,
        oneWay: { days: 2, returnHours: 22, driveHours: 13.2, wait: 10.75, homeHours: 10.5 },
        roundDays: 3,
      },
      Bilaspur: {
        km: 490,
        oneWay: { days: 1, returnHours: 19, driveHours: 9.8, wait: 10.75, homeHours: 8 },
        roundDays: 2,
      },
    },
  },
  {
    id: 'bhopal',
    name: 'Bhopal',
    nameHi: 'भोपाल',
    region: 'india',
    rail: { stations: ['BPL', 'RKMP'], hubs: ['NGP'] },
    from: {
      Raipur: {
        km: 628,
        oneWay: { days: 1, returnHours: 21, driveHours: 12.56, wait: 8, homeHours: 12.5 },
        roundDays: 2,
      },
      Bhilai: {
        km: 600,
        oneWay: { days: 1, returnHours: 21, driveHours: 12, wait: 8, homeHours: 12.75 },
        roundDays: 2,
      },
      Durg: {
        km: 590,
        oneWay: { days: 1, returnHours: 21, driveHours: 11.8, wait: 8, homeHours: 12.75 },
        roundDays: 2,
      },
      Bilaspur: {
        km: 650,
        oneWay: { days: 1, returnHours: 22, driveHours: 13, wait: 8, homeHours: 13.75 },
        roundDays: 3,
      },
    },
  },
  {
    id: 'varanasi',
    name: 'Varanasi',
    nameHi: 'वाराणसी',
    region: 'india',
    rail: { stations: ['BSB'], hubs: ['NGP', 'G'] },
    from: {
      Raipur: {
        km: 644,
        oneWay: { days: 1, returnHours: 24, driveHours: 12.88, wait: 7, homeHours: 17 },
        roundDays: 3,
      },
      Bhilai: {
        km: 660,
        oneWay: { days: 2, returnHours: 25, driveHours: 13.2, wait: 7, homeHours: 18 },
        roundDays: 3,
      },
      Durg: {
        km: 670,
        oneWay: { days: 2, returnHours: 25, driveHours: 13.4, wait: 7, homeHours: 18 },
        roundDays: 3,
      },
      Bilaspur: {
        km: 500,
        oneWay: { days: 1, returnHours: 22, driveHours: 10, wait: 7, homeHours: 15 },
        roundDays: 2,
      },
    },
  },
  {
    id: 'indore',
    name: 'Indore',
    nameHi: 'इंदौर',
    region: 'india',
    from: {
      Raipur: {
        km: 727,
        oneWay: { days: 2, returnHours: 18, driveHours: 14.54, wait: 1.5, homeHours: 16.5 },
        roundDays: 3,
      },
      Bhilai: {
        km: 700,
        oneWay: { days: 2, returnHours: 19, driveHours: 14, wait: 1.5, homeHours: 17.25 },
        roundDays: 3,
      },
      Durg: {
        km: 690,
        oneWay: { days: 2, returnHours: 19, driveHours: 13.8, wait: 1.5, homeHours: 17.25 },
        roundDays: 3,
      },
      Bilaspur: {
        km: 770,
        oneWay: { days: 2, returnHours: 20, driveHours: 15.4, wait: 1.5, homeHours: 18.5 },
        roundDays: 3,
      },
    },
  },
  {
    id: 'patna',
    name: 'Patna',
    nameHi: 'पटना',
    region: 'india',
    from: {
      Raipur: {
        km: 739,
        oneWay: { days: 2, returnHours: 21, driveHours: 14.78, wait: 1.5, homeHours: 19 },
        roundDays: 3,
      },
      Bhilai: {
        km: 770,
        oneWay: { days: 2, returnHours: 22, driveHours: 15.4, wait: 1.5, homeHours: 19.75 },
        roundDays: 3,
      },
      Durg: {
        km: 770,
        oneWay: { days: 2, returnHours: 22, driveHours: 15.4, wait: 1.5, homeHours: 19.75 },
        roundDays: 3,
      },
      Bilaspur: {
        km: 610,
        oneWay: { days: 1, returnHours: 23, driveHours: 12.2, wait: 1.5, homeHours: 21 },
        roundDays: 2,
      },
    },
  },
  {
    id: 'lucknow',
    name: 'Lucknow',
    nameHi: 'लखनऊ',
    region: 'india',
    rail: { stations: ['LKO', 'LJN'], hubs: ['NGP'] },
    from: {
      Raipur: {
        km: 779,
        oneWay: { days: 2, returnHours: 41, driveHours: 15.58, wait: 20.75, homeHours: 19.5 },
        roundDays: 3,
      },
      Bhilai: {
        km: 780,
        oneWay: { days: 2, returnHours: 42, driveHours: 15.6, wait: 20.75, homeHours: 20.5 },
        roundDays: 3,
      },
      Durg: {
        km: 780,
        oneWay: { days: 2, returnHours: 42, driveHours: 15.6, wait: 20.75, homeHours: 20.5 },
        roundDays: 3,
      },
      Bilaspur: {
        km: 680,
        oneWay: { days: 2, returnHours: 39, driveHours: 13.6, wait: 20.75, homeHours: 17.5 },
        roundDays: 3,
      },
    },
  },
  {
    id: 'hyderabad',
    name: 'Hyderabad',
    nameHi: 'हैदराबाद',
    region: 'india',
    rail: { stations: ['SC', 'HYB', 'KCG'], hubs: ['NGP'] },
    from: {
      Raipur: {
        km: 780,
        oneWay: { days: 2, returnHours: 23, driveHours: 15.6, wait: 9.5, homeHours: 13.5 },
        roundDays: 3,
      },
      Bhilai: {
        km: 750,
        oneWay: { days: 2, returnHours: 23, driveHours: 15, wait: 9.5, homeHours: 13.5 },
        roundDays: 3,
      },
      Durg: {
        km: 740,
        oneWay: { days: 2, returnHours: 23, driveHours: 14.8, wait: 9.5, homeHours: 13.5 },
        roundDays: 3,
      },
      Bilaspur: {
        km: 890,
        oneWay: { days: 2, returnHours: 25, driveHours: 17.8, wait: 9.5, homeHours: 15 },
        roundDays: 3,
      },
    },
  },
  {
    id: 'kolkata',
    name: 'Kolkata',
    nameHi: 'कोलकाता',
    region: 'india',
    rail: { stations: ['HWH', 'SHM'], hubs: [] },
    from: {
      Raipur: {
        km: 831,
        oneWay: { days: 2, returnHours: 17, driveHours: 16.62, wait: 4, homeHours: 13 },
        roundDays: 3,
      },
      Bhilai: {
        km: 860,
        oneWay: { days: 2, returnHours: 18, driveHours: 17.2, wait: 4, homeHours: 14 },
        roundDays: 3,
      },
      Durg: {
        km: 870,
        oneWay: { days: 2, returnHours: 18, driveHours: 17.4, wait: 4, homeHours: 14 },
        roundDays: 3,
      },
      Bilaspur: {
        km: 750,
        oneWay: { days: 2, returnHours: 15, driveHours: 15, wait: 4, homeHours: 11 },
        roundDays: 3,
      },
    },
  },
  {
    id: 'pune',
    name: 'Pune',
    nameHi: 'पुणे',
    region: 'india',
    rail: { stations: ['PUNE'], hubs: ['NGP'] },
    from: {
      Raipur: {
        km: 1007,
        oneWay: { days: 2, returnHours: 30, driveHours: 20.14, wait: 10, homeHours: 19.5 },
        roundDays: 4,
      },
      Bhilai: {
        km: 970,
        oneWay: { days: 2, returnHours: 29, driveHours: 19.4, wait: 10, homeHours: 19 },
        roundDays: 4,
      },
      Durg: {
        km: 970,
        oneWay: { days: 2, returnHours: 29, driveHours: 19.4, wait: 10, homeHours: 19 },
        roundDays: 4,
      },
      Bilaspur: {
        km: 1100,
        oneWay: { days: 2, returnHours: 32, driveHours: 22, wait: 10, homeHours: 21.5 },
        roundDays: 4,
      },
    },
  },
  {
    id: 'mumbai',
    name: 'Mumbai',
    nameHi: 'मुंबई',
    region: 'india',
    rail: { stations: ['CSMT', 'LTT'], hubs: ['NGP'] },
    from: {
      Raipur: {
        km: 1118,
        oneWay: { days: 2, returnHours: 22, driveHours: 22.36, wait: 4.75, homeHours: 17 },
        roundDays: 4,
      },
      Bhilai: {
        km: 1080,
        oneWay: { days: 2, returnHours: 21, driveHours: 21.6, wait: 4.75, homeHours: 16.25 },
        roundDays: 4,
      },
      Durg: {
        km: 1070,
        oneWay: { days: 2, returnHours: 21, driveHours: 21.4, wait: 4.75, homeHours: 16.25 },
        roundDays: 4,
      },
      Bilaspur: {
        km: 1210,
        oneWay: { days: 2, returnHours: 25, driveHours: 24.2, wait: 4.75, homeHours: 19.5 },
        roundDays: 4,
      },
    },
  },
  {
    id: 'delhi',
    name: 'Delhi',
    nameHi: 'दिल्ली',
    region: 'india',
    rail: { stations: ['NDLS', 'NZM'], hubs: ['NGP'] },
    from: {
      Raipur: {
        km: 1214,
        oneWay: { days: 2, returnHours: 30, driveHours: 24.28, wait: 7.25, homeHours: 22 },
        roundDays: 4,
      },
      Bhilai: {
        km: 1190,
        oneWay: { days: 2, returnHours: 29, driveHours: 23.8, wait: 7.25, homeHours: 21.5 },
        roundDays: 4,
      },
      Durg: {
        km: 1180,
        oneWay: { days: 2, returnHours: 29, driveHours: 23.6, wait: 7.25, homeHours: 21.5 },
        roundDays: 4,
      },
      Bilaspur: {
        km: 1130,
        oneWay: { days: 2, returnHours: 28, driveHours: 22.6, wait: 7.25, homeHours: 20.5 },
        roundDays: 4,
      },
    },
  },
  {
    id: 'bengaluru',
    name: 'Bengaluru',
    nameHi: 'बेंगलुरु',
    region: 'india',
    rail: { stations: ['SMVB', 'SBC', 'YPR'], hubs: ['NGP'] },
    from: {
      Raipur: {
        km: 1370,
        oneWay: { days: 3, returnHours: 35, driveHours: 27.4, wait: 8.75, homeHours: 26 },
        roundDays: 5,
      },
      Bhilai: {
        km: 1350,
        oneWay: { days: 3, returnHours: 34, driveHours: 27, wait: 8.75, homeHours: 25.25 },
        roundDays: 5,
      },
      Durg: {
        km: 1340,
        oneWay: { days: 3, returnHours: 34, driveHours: 26.8, wait: 8.75, homeHours: 25.25 },
        roundDays: 5,
      },
      Bilaspur: {
        km: 1480,
        oneWay: { days: 3, returnHours: 37, driveHours: 29.6, wait: 8.75, homeHours: 28 },
        roundDays: 5,
      },
    },
  },
  {
    id: 'chennai',
    name: 'Chennai',
    nameHi: 'चेन्नई',
    region: 'india',
    rail: { stations: ['MAS'], hubs: ['NGP'] },
    from: {
      Raipur: {
        km: 1405,
        oneWay: { days: 3, returnHours: 32, driveHours: 28.1, wait: 9.25, homeHours: 22.25 },
        roundDays: 5,
      },
      Bhilai: {
        km: 1360,
        oneWay: { days: 3, returnHours: 31, driveHours: 27.2, wait: 9.25, homeHours: 21.5 },
        roundDays: 5,
      },
      Durg: {
        km: 1360,
        oneWay: { days: 3, returnHours: 31, driveHours: 27.2, wait: 9.25, homeHours: 21.5 },
        roundDays: 5,
      },
      Bilaspur: {
        km: 1520,
        oneWay: { days: 3, returnHours: 34, driveHours: 30.4, wait: 9.25, homeHours: 24.25 },
        roundDays: 5,
      },
    },
  },
];

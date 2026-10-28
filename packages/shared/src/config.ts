/**
 * Prices, phone numbers and the notice bar — the things Nihal changes.
 *
 * They are NOT typed into the app. The website (Nihal51/very_new) publishes
 * them from its site-settings.ts at https://thedrivebuddy.in/app-config.json on
 * every deploy, and the app downloads that file on start. So a price edited on
 * GitHub reaches the website and every installed app within minutes, without a
 * new app release.
 *
 * DEFAULT_CONFIG is the copy built into the app, used on the very first launch
 * when there is no internet, and whenever the downloaded file fails the checks
 * in parseAppConfig (a bad file can never blank the price list).
 */

import { DEFAULT_DESTINATIONS } from './destinations';
import { parseDestinations, parseTripRules, type TripDestination, type TripRules } from './trip';

export type Range = { from: number; to: number };

export type AppConfig = {
  /** Bumped only if the file's shape changes in a way old apps cannot read. */
  schema: 1;
  contact: { phone: string; phoneAlt: string; whatsapp: string; email: string };
  notice: { show: boolean; text: string };
  prices: {
    oneHour: number;
    threeHours: number;
    fullDay: Range;
    /** Per day of an outstation trip or one-way drop. */
    outstation: Range;
    nightFrom: number;
  };
  /** How outstation estimates work (site-settings.ts → outstation). */
  outstation: TripRules;
  /** Destinations with km and days from each pickup city (lib/outstation.ts on the website). */
  destinations: TripDestination[];
  /**
   * Not in the file: true when the downloaded file had the trip blocks, i.e.
   * the website (and its firestore.rules, published with it) knows about
   * trips. Until then the app keeps the trip out of the booking's fields —
   * the old rules would refuse the booking — and writes it into the notes.
   */
  tripsLive: boolean;
  monthly: {
    basic: Range;
    joiningFeePercent: number;
    premium: number;
    premiumJoiningFeePercent: number;
    hoursPerDay: number;
    extraHour: number;
    daysOffPerMonth: number;
    standInPerDay: number;
    replacementDays: number;
  };
  google: { profile: string; writeReview: string };
  /** The alerts robot's doorbell; '' = alerts still come within a minute. */
  alerts: { pingUrl: string };
  site: { url: string; privacy: string; terms: string };
  /**
   * Installed apps older than minVersion show "Please update" (site-settings.ts
   * → app.minVersion on the website). Older website files have no `app`
   * block: then nothing is enforced.
   */
  app: { minVersion: string; playStoreUrl: string; appStoreUrl: string };
};

/** Snapshot of site-settings.ts on 28 Oct 2026. Only a fallback — see above. */
export const DEFAULT_CONFIG: AppConfig = {
  schema: 1,
  contact: {
    phone: '9111473929',
    phoneAlt: '9893302783',
    whatsapp: '9111473929',
    email: 'drivebuddyind@gmail.com',
  },
  notice: { show: false, text: '' },
  prices: {
    oneHour: 300,
    threeHours: 600,
    fullDay: { from: 1000, to: 1200 },
    outstation: { from: 1550, to: 1650 },
    nightFrom: 500,
  },
  outstation: {
    hoursPerDay: 12,
    extraHour: 120,
    returnHour: 120,
    returnMaxPerDay: 1200,
    mealAllowance: 300,
    kmPerDay: 600,
    localWithinKm: 60,
    stationHours: 1,
    averageKmh: 50,
  },
  destinations: DEFAULT_DESTINATIONS,
  tripsLive: false,
  monthly: {
    basic: { from: 16000, to: 17000 },
    joiningFeePercent: 25,
    premium: 20000,
    premiumJoiningFeePercent: 10,
    hoursPerDay: 9,
    extraHour: 100,
    daysOffPerMonth: 4,
    standInPerDay: 900,
    replacementDays: 1,
  },
  google: {
    profile: 'https://maps.app.goo.gl/5yJuHkFUZXmYgVhJ6',
    writeReview: 'https://search.google.com/local/writereview?placeid=ChIJs-jfFPrdKDoRHsazUysqIks',
  },
  alerts: { pingUrl: '' },
  site: {
    url: 'https://thedrivebuddy.in',
    privacy: 'https://thedrivebuddy.in/privacy/',
    terms: 'https://thedrivebuddy.in/terms/',
  },
  app: {
    minVersion: '0.0.0',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=in.thedrivebuddy.app',
    appStoreUrl: '',
  },
};

/* ------------------------------------------------------------- validation */

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isMoney = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 10_000_000;
const isCount = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 100;
const isMobile = (v: unknown): v is string => typeof v === 'string' && /^[6-9]\d{9}$/.test(v);
const isHttps = (v: unknown): v is string => typeof v === 'string' && /^https:\/\/\S+$/.test(v);
const isRange = (v: unknown): v is Range => isObj(v) && isMoney(v.from) && isMoney(v.to) && v.from <= v.to;
const isVersion = (v: unknown): v is string => typeof v === 'string' && /^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(v);
const isStoreUrl = (v: unknown, host: string) =>
  v === '' || (typeof v === 'string' && v.startsWith(`https://${host}/`));

/** 1.10.0 > 1.9.3 — compared number by number, not as text. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

/** True when the installed version is below the website's minimum. Unknown versions never block. */
export function mustUpdate(installed: string | null | undefined, config: AppConfig): boolean {
  return isVersion(installed) && compareVersions(installed, config.app.minVersion) < 0;
}

/**
 * The downloaded file → a config the app can trust, or null.
 * Every field is checked: one wrong value rejects the whole file, so the app
 * keeps the last good prices instead of showing a half-broken list.
 */
export function parseAppConfig(raw: unknown): AppConfig | null {
  if (!isObj(raw) || raw.schema !== 1) return null;
  const { contact, notice, prices, monthly, google, alerts, site, app, outstation, destinations } = raw;
  if (!isObj(contact) || !isObj(notice) || !isObj(prices) || !isObj(monthly)) return null;
  if (!isObj(google) || !isObj(alerts) || !isObj(site)) return null;

  // Trip estimates (added 19 Oct 2026). A website file from before then has
  // neither block: the built-in copies are used — and its prices.outstation,
  // which then meant "per trip", is replaced by the built-in per-day range.
  // If present, the blocks must be right.
  const hasTrips = outstation !== undefined || destinations !== undefined;
  const tripRules = hasTrips ? parseTripRules(outstation) : DEFAULT_CONFIG.outstation;
  const tripTable = hasTrips ? parseDestinations(destinations) : DEFAULT_CONFIG.destinations;
  if (!tripRules || !tripTable) return null;

  const ok =
    isMobile(contact.phone) &&
    isMobile(contact.phoneAlt) &&
    isMobile(contact.whatsapp) &&
    typeof contact.email === 'string' &&
    contact.email.includes('@') &&
    typeof notice.show === 'boolean' &&
    typeof notice.text === 'string' &&
    notice.text.length <= 200 &&
    isMoney(prices.oneHour) &&
    isMoney(prices.threeHours) &&
    isRange(prices.fullDay) &&
    isRange(prices.outstation) &&
    isMoney(prices.nightFrom) &&
    isRange(monthly.basic) &&
    isCount(monthly.joiningFeePercent) &&
    isMoney(monthly.premium) &&
    isCount(monthly.premiumJoiningFeePercent) &&
    isCount(monthly.hoursPerDay) &&
    isMoney(monthly.extraHour) &&
    isCount(monthly.daysOffPerMonth) &&
    isMoney(monthly.standInPerDay) &&
    isCount(monthly.replacementDays) &&
    (google.profile === '' || isHttps(google.profile)) &&
    (google.writeReview === '' || isHttps(google.writeReview)) &&
    (alerts.pingUrl === '' || isHttps(alerts.pingUrl)) &&
    isHttps(site.url) &&
    isHttps(site.privacy) &&
    isHttps(site.terms) &&
    (app === undefined ||
      (isObj(app) &&
        isVersion(app.minVersion) &&
        isStoreUrl(app.playStoreUrl, 'play.google.com') &&
        isStoreUrl(app.appStoreUrl, 'apps.apple.com')));
  if (!ok) return null;

  // Rebuild rather than cast, so unknown extra fields never leak into the app.
  const p = prices as AppConfig['prices'];
  const m = monthly as AppConfig['monthly'];
  return {
    schema: 1,
    contact: {
      phone: contact.phone as string,
      phoneAlt: contact.phoneAlt as string,
      whatsapp: contact.whatsapp as string,
      email: contact.email as string,
    },
    notice: { show: notice.show as boolean, text: notice.text as string },
    prices: {
      oneHour: p.oneHour,
      threeHours: p.threeHours,
      fullDay: { from: p.fullDay.from, to: p.fullDay.to },
      outstation: hasTrips
        ? { from: p.outstation.from, to: p.outstation.to }
        : { ...DEFAULT_CONFIG.prices.outstation },
      nightFrom: p.nightFrom,
    },
    outstation: tripRules,
    destinations: tripTable,
    tripsLive: hasTrips,
    monthly: {
      basic: { from: m.basic.from, to: m.basic.to },
      joiningFeePercent: m.joiningFeePercent,
      premium: m.premium,
      premiumJoiningFeePercent: m.premiumJoiningFeePercent,
      hoursPerDay: m.hoursPerDay,
      extraHour: m.extraHour,
      daysOffPerMonth: m.daysOffPerMonth,
      standInPerDay: m.standInPerDay,
      replacementDays: m.replacementDays,
    },
    google: { profile: google.profile as string, writeReview: google.writeReview as string },
    alerts: { pingUrl: alerts.pingUrl as string },
    site: { url: site.url as string, privacy: site.privacy as string, terms: site.terms as string },
    app: isObj(app)
      ? {
          minVersion: app.minVersion as string,
          playStoreUrl: app.playStoreUrl as string,
          appStoreUrl: app.appStoreUrl as string,
        }
      : { ...DEFAULT_CONFIG.app },
  };
}

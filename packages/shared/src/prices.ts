/**
 * Prices as the customer reads them — formatted exactly like the website
 * (lib/settings.ts there): Indian digit grouping (₹16,000, ₹1,00,000) and an
 * en dash for ranges (₹1,000–1,200).
 */

import type { PackageId } from './catalog';
import type { AppConfig, Range } from './config';

/**
 * 1600000 → "16,00,000". Done by hand rather than with Intl so the result is
 * the same on every phone, whatever locale data its JavaScript engine ships.
 */
export function indianDigits(n: number): string {
  const s = String(Math.round(Math.abs(n)));
  const sign = n < 0 ? '-' : '';
  if (s.length <= 3) return sign + s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${sign}${rest},${last3}`;
}

/** 16000 → "₹16,000" */
export const rupees = (n: number) => `₹${indianDigits(n)}`;

/** {1000, 1200} → "₹1,000–1,200"; a range whose ends match collapses to one price. */
export const rupeeRange = ({ from, to }: Range) =>
  from === to ? rupees(from) : `₹${indianDigits(from)}–${indianDigits(to)}`;

/** What a package costs, as data — the app adds the words ("from", "a month") in the customer's language. */
export type PackagePrice =
  | { kind: 'fixed'; amount: string }
  | { kind: 'from'; amount: string }
  | { kind: 'monthly'; amount: string }
  | { kind: 'priority' }
  | { kind: 'quote' };

export function packagePrice(config: AppConfig, id: PackageId): PackagePrice {
  const { prices: p, monthly: m } = config;
  switch (id) {
    case '1-hour-300':
      return { kind: 'fixed', amount: rupees(p.oneHour) };
    case '3-hours-600':
      return { kind: 'fixed', amount: rupees(p.threeHours) };
    case 'local-full-day':
      return { kind: 'fixed', amount: rupeeRange(p.fullDay) };
    case 'outstation':
      return { kind: 'fixed', amount: rupeeRange(p.outstation) };
    case 'night-driver':
      return { kind: 'from', amount: rupees(p.nightFrom) };
    case 'monthly-basic':
      return { kind: 'monthly', amount: rupeeRange(m.basic) };
    case 'monthly-premium':
      return { kind: 'monthly', amount: rupees(m.premium) };
    case 'medical-emergency':
      return { kind: 'priority' };
    case 'wedding-event':
    case 'one-way-drop':
      return { kind: 'quote' };
  }
}

/** The lowest listed price, for "drivers from ₹300". */
export function startingFrom(config: AppConfig): string {
  const p = config.prices;
  return rupees(Math.min(p.oneHour, p.threeHours, p.fullDay.from, p.nightFrom));
}

/** One-time joining fees of the monthly plans. */
export function joiningFees(config: AppConfig): { basic: string; premium: string } {
  const m = config.monthly;
  return {
    basic: rupeeRange({
      from: Math.round((m.basic.from * m.joiningFeePercent) / 100),
      to: Math.round((m.basic.to * m.joiningFeePercent) / 100),
    }),
    premium: rupees(Math.round((m.premium * m.premiumJoiningFeePercent) / 100)),
  };
}

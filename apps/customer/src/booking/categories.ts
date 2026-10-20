import { type AppConfig, type PackageId, isPackageId, packagePrice, rupees } from '@drivebuddy/shared';

import type { IconName } from '@/components/Button';
import type { Messages } from '@/i18n';
import { priceLabel } from '@/i18n/format';

/**
 * The services as the customer thinks of them: eight tiles, each one or two
 * packages. Home shows them as a grid; the first booking step too, so the
 * customer never has to read a list of ten options.
 */
export const CATEGORIES = [
  { id: 'hourly', icon: 'time', packages: ['1-hour-300', '3-hours-600'] },
  { id: 'day', icon: 'sunny', packages: ['local-full-day'] },
  { id: 'drop', icon: 'car', packages: ['one-way-drop'] },
  { id: 'outstation', icon: 'map', packages: ['outstation'] },
  { id: 'night', icon: 'moon', packages: ['night-driver'] },
  { id: 'monthly', icon: 'calendar', packages: ['monthly-basic', 'monthly-premium'] },
  { id: 'wedding', icon: 'sparkles', packages: ['wedding-event'] },
  { id: 'hospital', icon: 'medkit', packages: ['medical-emergency'] },
] as const satisfies readonly { id: string; icon: IconName; packages: readonly PackageId[] }[];

export type Category = (typeof CATEGORIES)[number];
export type CategoryId = Category['id'];

export const findCategory = (id: string | undefined): Category | undefined =>
  CATEGORIES.find((c) => c.id === id);

/** The tile a package belongs to. */
export const categoryOf = (pkg: string): Category | undefined =>
  isPackageId(pkg) ? CATEGORIES.find((c) => (c.packages as readonly string[]).includes(pkg)) : undefined;

/** The price on a tile: the cheapest way in ("from ₹300"), or the package's own label. */
export function categoryPrice(t: Messages, config: AppConfig, category: Category): string {
  switch (category.id) {
    case 'hourly':
      return t.price.from(rupees(Math.min(config.prices.oneHour, config.prices.threeHours)));
    case 'monthly':
      return t.price.monthlyFrom(rupees(config.monthly.basic.from));
    default:
      return priceLabel(t, packagePrice(config, category.packages[0]));
  }
}

/** Where a tile leads: straight to the details for one package, to the choice for two. */
export const categoryRoute = (category: Category) =>
  category.packages.length === 1
    ? { pathname: '/book' as const, params: { package: category.packages[0] } }
    : { pathname: '/book' as const, params: { category: category.id } };

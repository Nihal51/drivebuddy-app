/** Phone and link helpers shared by every screen. */

import { normalisePhone } from './validate';

/** "9111473929" → "+91 91114 73929" */
export function prettyPhone(p: string): string {
  const d = normalisePhone(String(p ?? '')).slice(-10);
  return d.length === 10 ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : p;
}

/** tel: link that dials from any phone. */
export const telUrl = (phone10: string) => `tel:+91${normalisePhone(phone10)}`;

/** WhatsApp chat with an optional pre-typed message. */
export function whatsappUrl(phone10: string, text?: string): string {
  const base = `https://wa.me/91${normalisePhone(phone10)}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

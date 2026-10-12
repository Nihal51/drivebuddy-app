/**
 * Dates and times, always in India time (IST, UTC+5:30) whatever the phone's
 * own time zone — a customer travelling abroad booking for their parents in
 * Raipur still means Raipur's 3 pm.
 *
 * The website stores the preferred time as the digits of an India-time
 * datetime-local value, "2026-10-08T15:30", or '' for "as soon as possible".
 * The app writes the same format, so the admin panel, the Sheet and the alerts
 * robot read app bookings exactly like website ones.
 *
 * Done with plain arithmetic instead of Intl time zones so it behaves the same
 * on every phone.
 */

const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 86_400_000;

export type IstParts = {
  year: number;
  month: number; // 1–12
  day: number; // 1–31
  weekday: number; // 0 = Sunday
  hour: number; // 0–23
  minute: number;
};

export function istParts(at: Date | number): IstParts {
  const d = new Date((typeof at === 'number' ? at : at.getTime()) + IST_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    weekday: d.getUTCDay(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-10-08" for the India-time calendar day containing `at`. */
export const istDateKey = (at: Date | number) => {
  const p = istParts(at);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
};

/** The digits of a stored preferred time as a real instant, or undefined for "as soon as possible". */
export function tripInstant(raw: string): Date | undefined {
  const m = (raw ?? '').trim().match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) return undefined;
  const [y, mo, d, h, mi] = m.slice(1).map(Number) as [number, number, number, number, number];
  return new Date(Date.UTC(y, mo - 1, d, h, mi) - IST_OFFSET_MS);
}

export type DayOption = { key: string; offset: number; parts: IstParts };

/** Today and the next `count - 1` days, India time. */
export function dayOptions(now: number, count = 7): DayOption[] {
  return Array.from({ length: count }, (_, offset) => {
    const at = now + offset * DAY_MS;
    return { key: istDateKey(at), offset, parts: istParts(at) };
  });
}

/**
 * Half-hour pickup slots, "HH:MM", from FIRST_SLOT to LAST_SLOT (night driver
 * bookings start late). For today, only slots at least `leadMinutes` away —
 * the time it takes to confirm and send a driver.
 */
export const FIRST_SLOT = 5 * 60; // 05:00
export const LAST_SLOT = 23 * 60 + 30; // 23:30

export function timeSlots(dateKey: string, now: number, leadMinutes = 45): string[] {
  const earliest = istDateKey(now) === dateKey ? minutesOfDay(now) + leadMinutes : -1;
  const slots: string[] = [];
  for (let m = FIRST_SLOT; m <= LAST_SLOT; m += 30) {
    if (m >= earliest) slots.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`);
  }
  return slots;
}

function minutesOfDay(at: number): number {
  const p = istParts(at);
  return p.hour * 60 + p.minute;
}

/** ("2026-10-08", "15:30") → "2026-10-08T15:30", the stored form. */
export const preferredTimeValue = (dateKey: string, slot: string) => `${dateKey}T${slot}`;

/** "15:30" → { hour12: 3, minute: "30", pm: true } for display. */
export function clock12(hour: number, minute: number): { text: string; pm: boolean } {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return { text: `${h}:${pad(minute)}`, pm: hour >= 12 };
}

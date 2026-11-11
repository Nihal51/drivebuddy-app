import { type ReturnOption, awayNote, istParts, waitNote } from '@drivebuddy/shared';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Fri 31 Oct, 11:40 pm" (India time), in English: the note is read by the team. */
function when(ms: number): string {
  const p = istParts(ms);
  const h = p.hour % 12 || 12;
  return `${DAYS[p.weekday]} ${p.day} ${MONTHS[p.month - 1]}, ${h}:${String(p.minute).padStart(2, '0')} ${p.hour < 12 ? 'am' : 'pm'}`;
}

/**
 * The train the estimate used, for the booking's notes (as the website):
 * "Train home in the estimate: 12105 Vidarbha Exp Fri 31 Oct, 11:40 pm
 * (timetable; not booked; he waits 3 h in all; he is away 35 h in all)." —
 * `homeAt`: hours after the start until he is home with that train (the
 * plan's), which is what the price is for.
 */
export function trainNote(o: ReturnOption, homeAt?: number): string {
  const legs = o.legs.map((l) => `${l.train.number} ${l.train.name} ${when(l.depart)}`).join(', then ');
  const away = homeAt !== undefined ? `; ${awayNote(homeAt)}` : '';
  return `Train home in the estimate: ${legs} (${o.scheduled ? 'timetable' : 'live'}; not booked; ${waitNote(o)}${away}).`;
}

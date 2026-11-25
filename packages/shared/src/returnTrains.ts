/**
 * The train check at the drop (SPEC-v4 §2, website lib/bookings.ts): when
 * the driver drops the car on a one-way drop over 160 km, the alerts robot
 * looks up up to 3 trains home and writes `returnCheck` on the booking
 * (robot-only); the customer books his ticket and taps "I booked this
 * train" (`returnChoice`, written once); the robot then writes the final
 * price with it (`returnPrice`, robot-only). The driver taps "Boarded the
 * train" (`tripTaps.boardAt`, copied into the booking's clock).
 *
 * Every reader accepts a missing or odd field and leaves it out — the robot
 * and the website may be a version ahead or behind the app.
 */

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Firestore Timestamp | Date → Date. */
function when(v: unknown): Date | undefined {
  if (v instanceof Date) return v;
  if (isObj(v) && typeof v.toDate === 'function') return (v.toDate as () => Date).call(v);
  return undefined;
}

/** One train home the robot found at the drop. */
export type ReturnCheckOption = {
  train: string;
  name: string;
  /** The station he boards at (code). */
  from: string;
  dep?: Date;
  arr?: Date;
  /** One change of train, if the route has one. */
  change: { station: string; train: string; dep?: Date } | null;
  /** Minutes from the drop to the departure; the wait charge and the whole price (before his ticket) with this train. */
  waitMin: number;
  waitCharge: number;
  price: number;
};

/**
 * The robot's train check at the drop: when it looked, the drop time, up to
 * 3 trains home; `bus`: none leaves within 12 hours of his being ready (a bus
 * is fine); `failed`: the lookup could not run (the team calls).
 */
export type ReturnCheck = {
  at?: Date;
  dropAt?: Date;
  options: ReturnCheckOption[];
  bus: boolean;
  failed: boolean;
};

/** The train the customer booked for him ("I booked this train"), or the office set. */
export type ReturnChoice = { train: string; dep?: Date; at?: Date };

/** The final price with the chosen train (robot-only). */
export type ReturnPrice = { price: number; waitCharge: number; train: string; at?: Date };

export function toReturnCheck(v: unknown): ReturnCheck | undefined {
  if (!isObj(v)) return undefined;
  const options = (Array.isArray(v.options) ? v.options : []).flatMap((o): ReturnCheckOption[] => {
    if (!isObj(o) || !str(o.train)) return [];
    const ch = isObj(o.change) ? o.change : null;
    return [
      {
        train: str(o.train),
        name: str(o.name),
        from: str(o.from),
        dep: when(o.dep),
        arr: when(o.arr),
        change: ch ? { station: str(ch.station), train: str(ch.train), dep: when(ch.dep) } : null,
        waitMin: num(o.waitMin),
        waitCharge: num(o.waitCharge),
        price: num(o.price),
      },
    ];
  });
  return { at: when(v.at), dropAt: when(v.dropAt), options, bus: v.bus === true, failed: v.failed === true };
}

export function toReturnChoice(v: unknown): ReturnChoice | undefined {
  if (!isObj(v) || !str(v.train)) return undefined;
  return { train: str(v.train), dep: when(v.dep), at: when(v.at) };
}

export function toReturnPrice(v: unknown): ReturnPrice | undefined {
  if (!isObj(v) || typeof v.price !== 'number' || !str(v.train)) return undefined;
  return { price: v.price, waitCharge: num(v.waitCharge), train: str(v.train), at: when(v.at) };
}

/** firestore.rules isReturnChoice: a train number of 4–5 digits. */
export const isTrainNumber = (v: unknown): v is string => typeof v === 'string' && /^[0-9]{4,5}$/.test(v);

/**
 * "I booked this train" — what firestore.rules allows the customer to
 * write, or why not: the robot's check is there, nothing chosen yet, the
 * booking still open (confirmed / assigned), and the train one of the
 * offered ones, with its departure. The caller adds `at` (server time).
 */
export function returnChoiceFields(
  b: { status: string; returnCheck?: ReturnCheck; returnChoice?: ReturnChoice },
  train: string,
):
  | { ok: true; train: string; dep: Date }
  | { ok: false; reason: 'closed' | 'no-check' | 'chosen' | 'not-offered' } {
  if (b.status !== 'confirmed' && b.status !== 'assigned') return { ok: false, reason: 'closed' };
  if (!b.returnCheck) return { ok: false, reason: 'no-check' };
  if (b.returnChoice) return { ok: false, reason: 'chosen' };
  const o = b.returnCheck.options.slice(0, 3).find((x) => x.train === train);
  if (!o || !o.dep || !isTrainNumber(o.train)) return { ok: false, reason: 'not-offered' };
  return { ok: true, train: o.train, dep: o.dep };
}

/** The final price shown with the choice: the robot's returnPrice for that train, else null (it comes in a minute). */
export const finalTrainPrice = (b: {
  returnChoice?: ReturnChoice;
  returnPrice?: ReturnPrice;
}): number | null =>
  b.returnChoice && b.returnPrice && b.returnPrice.train === b.returnChoice.train
    ? b.returnPrice.price
    : null;

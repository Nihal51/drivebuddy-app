/**
 * Job offers (website firestore.rules, offers/{bookingId}): the office offers a
 * booking to the Active drivers of its city with what the driver earns. The
 * first to accept takes it — the offer and the booking change together in one
 * transaction, which the rules check — and it becomes one of his jobs. His
 * taken offers are also his earnings: what DriveBuddy owes him and has paid.
 * Until he taps Start he can give a job back ("Can't make it"): the offer
 * becomes "released" and the alerts robot offers it to the others again.
 * When a customer pays him in cash, the robot writes it on the offer
 * (`cashCollected`): that cash is DriveBuddy's, so it comes off his weekly pay.
 *
 * He is named on an offer he takes by id and name only (SPEC-privacy, 25 Nov
 * 2026): the same ref goes on the booking, which the customer reads, so it
 * never carries his number. Offers taken by older app versions also have it.
 */

import { type PackageId, isPackageId, toDate } from '@drivebuddy/shared';
import {
  collection,
  doc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore';

import { env } from '@/env';
import { firestore } from '@/firebase/app';

import { type WriteFailure, failureOf, within } from './write';

/** 'released' = the driver who took it gave it back; the robot opens it again. */
export type OfferStatus = 'open' | 'taken' | 'withdrawn' | 'released';
const STATUSES: readonly string[] = ['open', 'taken', 'withdrawn', 'released'];

export type Offer = {
  id: string;
  ref: string;
  city: string;
  /** The cities whose drivers see it: its own, plus the neighbours once nobody near has taken it. */
  cities: string[];
  packageId: PackageId | null;
  when: string;
  area: string;
  to: string;
  driverPay: number;
  status: OfferStatus;
  /** Who took it: his driver id; his number only on offers taken by older app versions. */
  takenPhone: string;
  takenId: string;
  takenAt?: Date;
  done: boolean;
  paid: boolean;
  paidAt?: Date;
  /** Rupees the customer paid him in cash for this job (robot only); 0 = none. */
  cashCollected: number;
};

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export function toOffer(id: string, d: Record<string, unknown>): Offer {
  const status = STATUSES.includes(str(d.status)) ? (d.status as OfferStatus) : 'withdrawn';
  const taken = (d.takenBy ?? null) as Record<string, unknown> | null;
  const city = str(d.city);
  const cities = Array.isArray(d.cities) ? d.cities.filter((c): c is string => typeof c === 'string') : [];
  return {
    id,
    ref: str(d.ref),
    city,
    cities: cities.length ? cities : city ? [city] : [],
    packageId: isPackageId(d.package) ? d.package : null,
    when: str(d.when),
    area: str(d.area),
    to: str(d.to),
    driverPay: num(d.driverPay),
    status,
    takenPhone: taken ? str(taken.phone) : '',
    takenId: taken ? str(taken.id) : '',
    takenAt: toDate(d.takenAt),
    done: d.done === true,
    paid: d.paid === true,
    paidAt: toDate(d.paidAt),
    cashCollected:
      typeof d.cashCollected === 'number' && Number.isInteger(d.cashCollected) && d.cashCollected > 0
        ? d.cashCollected
        : 0,
  };
}

export type Earnings = {
  /** Done and not paid yet: what he earned on them (before the cash he kept). */
  owed: number;
  /** Cash customers paid him on those same jobs: DriveBuddy's money, kept by him. */
  cashKept: number;
  /** owed − cashKept: DriveBuddy pays him this at the weekly payout; below 0, he owes DriveBuddy. */
  net: number;
  /** Taken, not done yet. */
  upcoming: number;
  /** Paid to him. */
  paid: number;
  /** Newest first, without withdrawn (cancelled) or released (given back) ones. */
  list: Offer[];
};

/**
 * His taken offers → what DriveBuddy owes him, what is coming, what it has
 * paid. The weekly payout is worked out the same way by the robot (SPEC-upi
 * item 6): over his done, unpaid jobs, what he earned less the cash he kept.
 */
export function earningsOf(offers: Offer[]): Earnings {
  const list = offers
    .filter((o) => o.status === 'taken')
    .sort((a, b) => (b.takenAt?.getTime() ?? 0) - (a.takenAt?.getTime() ?? 0));
  const sum = (f: (o: Offer) => boolean, v: (o: Offer) => number = (o) => o.driverPay) =>
    list.filter(f).reduce((t, o) => t + v(o), 0);
  const due = (o: Offer) => o.done && !o.paid;
  const owed = sum(due);
  const cashKept = sum(due, (o) => o.cashCollected);
  return {
    owed,
    cashKept,
    net: owed - cashKept,
    upcoming: sum((o) => !o.done && !o.paid),
    paid: sum((o) => o.paid),
    list,
  };
}

/** Rupees he owes DriveBuddy (the cash he kept beyond what he earned), 0 when DriveBuddy owes him. */
export const cashOwed = (e: Pick<Earnings, 'net'>): number => Math.max(0, -e.net);

/**
 * Over the cash limit (SPEC-upi item 11): he holds more of DriveBuddy's cash
 * than allowed, so the robot stops sending him new offers until he settles.
 * The same sum the robot makes, so the warning shows when the offers stop.
 */
export const overCashLimit = (e: Pick<Earnings, 'net'>, limit: number): boolean => cashOwed(e) > limit;

/**
 * Several live lists of the same offers → one, each offer once, soonest first.
 * `undefined` = that list has not loaded yet, null = it could not be read; the
 * result is null only when none could be read.
 */
export function mergeOffers(lists: (Offer[] | null | undefined)[]): Offer[] | null {
  if (lists.length && lists.every((l) => l === null)) return null;
  const byId = new Map<string, Offer>();
  for (const list of lists) for (const o of list ?? []) if (!byId.has(o.id)) byId.set(o.id, o);
  return [...byId.values()].filter((o) => o.status === 'open').sort((a, b) => a.when.localeCompare(b.when));
}

/**
 * Open offers for his city, live; soonest first. Offers now carry `cities`
 * (its own city, and the neighbours when nobody near takes it); offers made
 * before that only have `city`. Both are asked for and merged, each on its
 * own, so the one the rules or the data do not support yet cannot hide the
 * other during the switch-over.
 */
export function watchOpenOffers(
  city: string,
  /** `complete`: both lists have answered (an offer missing now is really not open for him). */
  onChange: (offers: Offer[] | null, complete: boolean) => void,
): () => void {
  const offers = collection(firestore(), 'offers');
  const queries = [
    query(offers, where('status', '==', 'open'), where('cities', 'array-contains', city)),
    query(offers, where('status', '==', 'open'), where('city', '==', city)),
  ];
  const lists: (Offer[] | null | undefined)[] = queries.map(() => undefined);
  const emit = () =>
    onChange(
      mergeOffers(lists),
      lists.every((l) => l !== undefined),
    );
  const offs = queries.map((q, i) =>
    onSnapshot(
      q,
      (snap) => {
        lists[i] = snap.docs.map((d) => toOffer(d.id, d.data()));
        emit();
      },
      () => {
        lists[i] = null;
        emit();
      },
    ),
  );
  return () => offs.forEach((off) => off());
}

/** One offer, live — to know whether this job came from an offer he took. null = none, or not readable. */
export function watchOffer(id: string, onChange: (offer: Offer | null) => void): () => void {
  return onSnapshot(
    doc(firestore(), 'offers', id),
    (snap) => onChange(snap.exists() ? toOffer(snap.id, snap.data()) : null),
    () => onChange(null),
  );
}

/** The driver, as the offers know him. */
export type Me = { driverId: string; phone: string };

/**
 * Taken by him: by his driver id — or, for a ref without an id, by his
 * number. (Every offer's takenBy has an id — firestore.rules isDriverRef — so
 * the number is only a safety net.)
 */
export const takenByMe = (o: Pick<Offer, 'takenId' | 'takenPhone'>, me: Me): boolean =>
  o.takenId ? o.takenId === me.driverId : Boolean(me.phone) && o.takenPhone === me.phone;

/** Every offer he has taken, live (his earnings): by his driver id, as the rules' isMe checks. */
export function watchMyOffers(driverId: string, onChange: (offers: Offer[] | null) => void): () => void {
  if (!driverId) {
    onChange(null);
    return () => {};
  }
  const q = query(collection(firestore(), 'offers'), where('takenBy.id', '==', driverId));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => toOffer(d.id, d.data()))),
    () => onChange(null),
  );
}

export type AcceptResult = { ok: true } | { ok: false; reason: 'gone' | 'failed' };

/**
 * Take the job: the offer becomes his and the booking is assigned to him, in one
 * transaction (both or neither). Someone faster → 'gone'. He is written as
 * { id, name } — exactly his record's name (firestore.rules isMeAsDriver) and
 * no number: the customer reads the booking.
 */
export async function acceptOffer(
  offerId: string,
  me: { driverId: string; name: string; uid: string },
): Promise<AcceptResult> {
  const db = firestore();
  const ref = { id: me.driverId, name: me.name };
  try {
    await runTransaction(db, async (tx) => {
      const offer = await tx.get(doc(db, 'offers', offerId));
      if (!offer.exists() || offer.data().status !== 'open') throw new Error('gone');
      tx.update(doc(db, 'offers', offerId), {
        status: 'taken',
        takenBy: ref,
        takenAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      tx.update(doc(db, 'bookings', offerId), {
        status: 'assigned',
        assignedDriver: ref,
        updatedAt: serverTimestamp(),
        updatedBy: me.uid,
      });
    });
  } catch (err) {
    const gone =
      (err instanceof Error && err.message === 'gone') ||
      (typeof err === 'object' && err !== null && (err as { code?: string }).code === 'permission-denied');
    return { ok: false, reason: gone ? 'gone' : 'failed' };
  }
  // The robot tells the customer "driver assigned" now, not at its next minute.
  void fetch(env.robotUrl, { method: 'POST' }).catch(() => {});
  return { ok: true };
}

/* ------------------------------------------------- waiting for confirmation */

/**
 * Jobs he took that DriveBuddy has not confirmed yet: his taken, not-done
 * offers with no confirmed job in My jobs. Shown from the offer only (no
 * customer details) until the office's call; then the job replaces it.
 * Soonest first, like the offers.
 */
export function waitingOffers(myOffers: Offer[], confirmedJobIds: string[], me: Me): Offer[] {
  const confirmed = new Set(confirmedJobIds);
  return myOffers
    .filter((o) => o.status === 'taken' && takenByMe(o, me) && !o.done && !confirmed.has(o.id))
    .sort((a, b) => a.when.localeCompare(b.when));
}

/* ------------------------------------------------------------ can't make it */

export type ReleaseCheck = 'ok' | 'not-from-offer' | 'started';

/**
 * May he give this job back? Only a job he took from an offer (the office
 * assigns its own jobs by phone, and takes them back the same way), and only
 * before he tapped Start: once he is on his way the customer is waiting for
 * him, so it goes through the office. Decided from the offer alone: before
 * DriveBuddy's call he cannot read the booking yet (firestore.rules checks
 * the booking is still his when the change is written).
 */
export function releaseCheck(
  offer: Pick<Offer, 'status' | 'takenPhone' | 'takenId'> | null,
  started: boolean,
  me: Me,
): ReleaseCheck {
  if (!offer || offer.status !== 'taken' || !takenByMe(offer, me)) return 'not-from-offer';
  if (started) return 'started';
  return 'ok';
}

export type ReleaseResult = { ok: true } | { ok: false; reason: Exclude<ReleaseCheck, 'ok'> | WriteFailure };

class NotAllowed extends Error {
  constructor(readonly check: Exclude<ReleaseCheck, 'ok'>) {
    super(check);
  }
}

/**
 * "Can't make it": in one transaction, the offer taken → released and the
 * booking assigned → confirmed with no driver (both or neither; the rules
 * check them together). Only the offer is read first — the booking may not
 * be readable to him yet (before DriveBuddy's call), so it is written without
 * reading it; the rules refuse the write if it is no longer his, and a job
 * the office changed meanwhile is left alone. `started` = his Start tap is
 * saved (the rules check that too).
 */
export async function releaseJob(
  bookingId: string,
  me: Me & { uid: string },
  started: boolean,
): Promise<ReleaseResult> {
  const db = firestore();
  const offerRef = doc(db, 'offers', bookingId);
  const bookingRef = doc(db, 'bookings', bookingId);
  try {
    await within(
      runTransaction(db, async (tx) => {
        const offer = await tx.get(offerRef);
        const check = releaseCheck(offer.exists() ? toOffer(offer.id, offer.data()) : null, started, me);
        if (check !== 'ok') throw new NotAllowed(check);
        tx.update(offerRef, { status: 'released', updatedAt: serverTimestamp() });
        tx.update(bookingRef, {
          status: 'confirmed',
          assignedDriver: null,
          updatedAt: serverTimestamp(),
          updatedBy: me.uid,
        });
      }),
    );
  } catch (err) {
    if (err instanceof NotAllowed) return { ok: false, reason: err.check };
    return { ok: false, reason: failureOf(err) };
  }
  // The robot offers it to the other drivers now, not at its next minute.
  void fetch(env.robotUrl, { method: 'POST' }).catch(() => {});
  return { ok: true };
}

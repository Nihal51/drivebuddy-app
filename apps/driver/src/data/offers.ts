/**
 * Job offers (website firestore.rules, offers/{bookingId}): the office offers a
 * booking to the Active drivers of its city with what the driver earns. The
 * first to accept takes it — the offer and the booking change together in one
 * transaction, which the rules check — and it becomes one of his jobs. His
 * taken offers are also his earnings: what DriveBuddy owes him and has paid.
 */

import { type PackageId, isPackageId, toDate } from '@drivebuddy/shared';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore';

import { env } from '@/env';
import { firestore } from '@/firebase/app';

export type Offer = {
  id: string;
  ref: string;
  city: string;
  packageId: PackageId | null;
  when: string;
  area: string;
  to: string;
  driverPay: number;
  status: 'open' | 'taken' | 'withdrawn';
  takenPhone: string;
  takenAt?: Date;
  done: boolean;
  paid: boolean;
  paidAt?: Date;
};

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export function toOffer(id: string, d: Record<string, unknown>): Offer {
  const status = d.status === 'open' || d.status === 'taken' ? d.status : 'withdrawn';
  const taken = (d.takenBy ?? null) as Record<string, unknown> | null;
  return {
    id,
    ref: str(d.ref),
    city: str(d.city),
    packageId: isPackageId(d.package) ? d.package : null,
    when: str(d.when),
    area: str(d.area),
    to: str(d.to),
    driverPay: num(d.driverPay),
    status,
    takenPhone: taken ? str(taken.phone) : '',
    takenAt: toDate(d.takenAt),
    done: d.done === true,
    paid: d.paid === true,
    paidAt: toDate(d.paidAt),
  };
}

export type Earnings = {
  /** Done and not paid yet: DriveBuddy owes him this. */
  owed: number;
  /** Taken, not done yet. */
  upcoming: number;
  /** Paid to him. */
  paid: number;
  /** Newest first, without withdrawn (cancelled) ones. */
  list: Offer[];
};

/** His taken offers → what DriveBuddy owes him, what is coming, what it has paid. */
export function earningsOf(offers: Offer[]): Earnings {
  const list = offers
    .filter((o) => o.status === 'taken')
    .sort((a, b) => (b.takenAt?.getTime() ?? 0) - (a.takenAt?.getTime() ?? 0));
  const sum = (f: (o: Offer) => boolean) => list.filter(f).reduce((t, o) => t + o.driverPay, 0);
  return {
    owed: sum((o) => o.done && !o.paid),
    upcoming: sum((o) => !o.done && !o.paid),
    paid: sum((o) => o.paid),
    list,
  };
}

export type MyRecord = { name: string; city: string; status: string };

/** His own driver record (name, city, status), or null (the review login has none). */
export async function readMyRecord(driverId: string): Promise<MyRecord | null> {
  if (!driverId) return null;
  try {
    const snap = await getDoc(doc(firestore(), 'drivers', driverId));
    if (!snap.exists()) return null;
    const d = snap.data();
    return { name: str(d.name), city: str(d.city), status: str(d.status) };
  } catch {
    return null;
  }
}

/** Open offers in his city, live; soonest first. */
export function watchOpenOffers(city: string, onChange: (offers: Offer[] | null) => void): () => void {
  const q = query(
    collection(firestore(), 'offers'),
    where('status', '==', 'open'),
    where('city', '==', city),
  );
  return onSnapshot(
    q,
    (snap) =>
      onChange(snap.docs.map((d) => toOffer(d.id, d.data())).sort((a, b) => a.when.localeCompare(b.when))),
    () => onChange(null),
  );
}

/** Every offer he has taken, live (his earnings). */
export function watchMyOffers(phone: string, onChange: (offers: Offer[] | null) => void): () => void {
  const q = query(collection(firestore(), 'offers'), where('takenBy.phone', '==', phone));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => toOffer(d.id, d.data()))),
    () => onChange(null),
  );
}

export type AcceptResult = { ok: true } | { ok: false; reason: 'gone' | 'failed' };

/**
 * Take the job: the offer becomes his and the booking is assigned to him, in one
 * transaction (both or neither). Someone faster → 'gone'.
 */
export async function acceptOffer(
  offerId: string,
  me: { driverId: string; name: string; phone: string; uid: string },
): Promise<AcceptResult> {
  const db = firestore();
  const ref = { id: me.driverId, name: me.name, phone: me.phone };
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

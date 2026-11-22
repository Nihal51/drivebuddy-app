/**
 * The "New job" popup (like Rapido / Uber): while he is Online, every open
 * offer he has not been shown yet pops up full screen, one at a time, for 30
 * seconds. Once shown (Accept, Not now or the time ran out) an offer never
 * pops up again — unless its pay went up since ("Pay raised"). A tap on the
 * job alert opens that offer's popup even if he saw it before.
 *
 * What he has been shown is kept on the phone, so closing the app does not
 * bring back every offer he already said "Not now" to.
 */

import { readJson, writeJson } from '@/lib/storage';

import type { Offer } from './offers';

export const POPUP_SECONDS = 30;

/** Shown offers: id → the pay he was shown and when (ms). */
export type Seen = Record<string, { pay: number; at: number }>;

export type PopupPick = { offer: Offer; raised: boolean };

/**
 * The offer to pop up next, or null: the first open one (the list comes
 * soonest job first) he has not been shown, or whose pay went up since.
 */
export function nextPopup(offers: Offer[], seen: Seen): PopupPick | null {
  for (const offer of offers) {
    if (offer.status !== 'open') continue;
    const before = seen[offer.id];
    if (!before) return { offer, raised: false };
    if (offer.driverPay > before.pay) return { offer, raised: true };
  }
  return null;
}

/** Remember that he was shown this offer at this pay. */
export const markSeen = (seen: Seen, offer: Pick<Offer, 'id' | 'driverPay'>, now: number): Seen => ({
  ...seen,
  [offer.id]: { pay: offer.driverPay, at: now },
});

/** Whole seconds left on the popup (30 → 0); 0 = it closes. */
export function secondsLeft(openedAt: number, now: number, total: number = POPUP_SECONDS): number {
  return Math.max(0, Math.ceil((openedAt + total * 1000 - now) / 1000));
}

export const expired = (openedAt: number, now: number, total: number = POPUP_SECONDS): boolean =>
  secondsLeft(openedAt, now, total) === 0;

/** The offer, as it is now in his open offers; null = taken by someone else, withdrawn, or not for him. */
export const liveOffer = (offers: Offer[], id: string): Offer | null =>
  offers.find((o) => o.id === id && o.status === 'open') ?? null;

/** The offer id in a job alert's data ({ offerId }), or null for any other notification. */
export function offerIdOf(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null;
  const id = (data as { offerId?: unknown }).offerId;
  return typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id) ? id : null;
}

/* ------------------------------------------------------------ on the phone */

const STORE_KEY = 'dbd.popupSeen.v1';
/** Offers are done within days: older entries are dropped, and the list never grows past this. */
const KEEP_MS = 7 * 24 * 60 * 60 * 1000;
const KEEP_MAX = 300;

/** Only entries that make sense, newer than a week, at most the newest KEEP_MAX. */
export function tidySeen(raw: unknown, now: number): Seen {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const ok = Object.entries(raw as Record<string, unknown>).flatMap(([id, v]) => {
    const e = v as { pay?: unknown; at?: unknown } | null;
    return e && typeof e.pay === 'number' && typeof e.at === 'number' && now - e.at < KEEP_MS
      ? [[id, { pay: e.pay, at: e.at }] as const]
      : [];
  });
  ok.sort((a, b) => b[1].at - a[1].at);
  return Object.fromEntries(ok.slice(0, KEEP_MAX));
}

export async function loadSeen(now: number = Date.now()): Promise<Seen> {
  return tidySeen(await readJson<unknown>(STORE_KEY), now);
}

export const saveSeen = (seen: Seen, now: number = Date.now()) => writeJson(STORE_KEY, tidySeen(seen, now));

/* ------------------------------------------------------------ the queue */

/** What the screen shows: the popup's offer (as it is now), or null. */
export type PopupView = { offer: Offer; raised: boolean; openedAt: number; busy: boolean } | null;

/** What the controller does outside itself: the clock, the buzz, the phone's memory. */
export type PopupEffects = {
  now: () => number;
  /** true when a popup opens, false when it closes. */
  buzz: (on: boolean) => void;
  save: (seen: Seen) => void;
};

/**
 * One popup at a time, the rest waiting in his open offers. Plain JavaScript
 * (the screen reads it with useSyncExternalStore), so each rule is tested
 * without a screen:
 * - an open popup whose offer went (taken, withdrawn) closes with "gone";
 * - a tapped job alert comes first: that offer if it is still open for him
 *   (Online or not), else "gone";
 * - else, while Online, Active and in front: the next offer he has not been
 *   shown, or whose pay went up.
 * Nothing pops until what he was shown before has been read from the phone.
 */
export class PopupController {
  private offers: Offer[] = [];
  private loaded = false;
  private watching = false;
  private canPop = false;
  private front = true;
  private seen: Seen | null = null;
  private tapped: string | null = null;
  private open: { offer: Offer; raised: boolean; openedAt: number } | null = null;
  private busy = false;
  private view: PopupView = null;
  private readonly listeners = new Set<() => void>();
  private readonly goneListeners = new Set<() => void>();

  constructor(private readonly fx: PopupEffects) {}

  /** Told when an offer he was shown or tapped is no longer open for him ("another driver took it"). */
  onGone = (fn: () => void): (() => void) => {
    this.goneListeners.add(fn);
    return () => this.goneListeners.delete(fn);
  };

  private gone() {
    this.goneListeners.forEach((fn) => fn());
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getView = (): PopupView => this.view;

  /** His open offers and whether popups may open by themselves. */
  update(
    next: Partial<{ offers: Offer[]; loaded: boolean; watching: boolean; canPop: boolean; front: boolean }>,
  ) {
    Object.assign(this, next);
    this.step();
  }

  /** What he was shown before (from the phone); anything shown meanwhile is kept. */
  seenLoaded(saved: Seen) {
    this.seen = { ...saved, ...(this.seen ?? {}) };
    this.step();
  }

  /** A tap on the job alert for this offer. */
  tap(offerId: string) {
    this.tapped = offerId;
    this.step();
  }

  /** Not now, or the 30 seconds ran out. */
  dismiss() {
    if (!this.open || this.busy) return;
    this.close(this.currentOffer());
    this.step();
  }

  /** Accept through `take` (the accept transaction); the popup closes after it, with its words. */
  async accept(take: (offer: Offer) => Promise<string>): Promise<string | null> {
    if (!this.open || this.busy) return null;
    const offer = this.currentOffer();
    this.busy = true;
    this.publish();
    let words: string;
    try {
      words = await take(offer);
    } finally {
      this.busy = false;
    }
    this.close(offer);
    this.step();
    return words;
  }

  private currentOffer(): Offer {
    const open = this.open as NonNullable<PopupController['open']>;
    return liveOffer(this.offers, open.offer.id) ?? open.offer;
  }

  private remember(offer: Offer) {
    this.seen = markSeen(this.seen ?? {}, offer, this.fx.now());
    this.fx.save(this.seen);
  }

  private show(offer: Offer, raised: boolean) {
    this.remember(offer);
    this.open = { offer, raised, openedAt: this.fx.now() };
    this.fx.buzz(true);
  }

  private close(offer: Offer) {
    // At the pay he saw last: it may have gone up while the popup was open.
    this.remember(offer);
    this.open = null;
    this.fx.buzz(false);
  }

  private step() {
    if (this.open && !this.busy && this.loaded && !liveOffer(this.offers, this.open.offer.id)) {
      this.close(this.open.offer);
      this.gone();
    }
    if (!this.open && this.seen) {
      if (this.tapped && (this.loaded || !this.watching)) {
        const id = this.tapped;
        this.tapped = null;
        const offer = this.watching ? liveOffer(this.offers, id) : null;
        const before = offer ? this.seen[offer.id] : undefined;
        if (offer) this.show(offer, Boolean(before && offer.driverPay > before.pay));
        else this.gone();
      } else if (!this.tapped && this.canPop && this.front && this.loaded) {
        const pick = nextPopup(this.offers, this.seen);
        if (pick) this.show(pick.offer, pick.raised);
      }
    }
    this.publish();
  }

  /** A new view object only when something on it changed (useSyncExternalStore compares them). */
  private publish() {
    const next: PopupView = this.open
      ? {
          offer: this.currentOffer(),
          raised: this.open.raised,
          openedAt: this.open.openedAt,
          busy: this.busy,
        }
      : null;
    const prev = this.view;
    const same =
      prev === next ||
      (prev !== null &&
        next !== null &&
        prev.offer === next.offer &&
        prev.raised === next.raised &&
        prev.openedAt === next.openedAt &&
        prev.busy === next.busy);
    if (same) return;
    this.view = next;
    this.listeners.forEach((fn) => fn());
  }
}

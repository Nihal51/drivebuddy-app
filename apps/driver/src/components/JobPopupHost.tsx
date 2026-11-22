/**
 * Shows the "New job" popup when the rules in data/popup.ts (PopupController)
 * say so: by itself while he is Online and Active and the app is in front,
 * and after a tap on a job alert — also when the tap started the app. Lives
 * on the home screen, which stays under every other screen; a Modal shows
 * above all of them.
 */

import { router } from 'expo-router';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Alert, AppState, Vibration } from 'react-native';

import type { Offer } from '@/data/offers';
import { PopupController, loadSeen, saveSeen } from '@/data/popup';
import { useI18n } from '@/i18n';
import { watchOfferTaps } from '@/notifications/push';

import { JobPopup } from './JobPopup';

/** Buzz, pause, buzz, pause, buzz — felt in a pocket or a phone holder. */
const VIBRATION = [0, 500, 250, 500, 250, 500];

function buzz(on: boolean) {
  try {
    if (on) Vibration.vibrate(VIBRATION);
    else Vibration.cancel();
  } catch {
    /* no vibrator: the popup still shows */
  }
}

/** In front unless the phone says otherwise ('unknown' just after start counts as in front). */
const inFront = (state: string | null | undefined) => state !== 'background' && state !== 'inactive';

export function JobPopupHost({
  offers,
  loaded,
  watching,
  canPop,
  myCity,
  onTake,
}: {
  /** His open offers, soonest first. */
  offers: Offer[];
  /** Both offer lists have answered. */
  loaded: boolean;
  /** His offers are being listened to (he is Active); if not, a tapped alert's offer is gone. */
  watching: boolean;
  /** Online and Active: pop up new offers by themselves. */
  canPop: boolean;
  myCity: string;
  /** Accept, as from the list: the transaction, then the words to show (accepted / gone / failed). */
  onTake: (offer: Offer) => Promise<string>;
}) {
  const { t } = useI18n();
  const [ctl] = useState(
    () => new PopupController({ now: () => Date.now(), buzz, save: (seen) => void saveSeen(seen) }),
  );
  const view = useSyncExternalStore(ctl.subscribe, ctl.getView);

  // Before anything below can make it happen.
  useEffect(() => ctl.onGone(() => Alert.alert(t.appName, t.offers.gone)), [ctl, t]);

  useEffect(() => {
    let alive = true;
    void loadSeen().then((seen) => alive && ctl.seenLoaded(seen));
    return () => {
      alive = false;
    };
  }, [ctl]);

  useEffect(() => ctl.update({ offers, loaded, watching, canPop }), [ctl, offers, loaded, watching, canPop]);

  useEffect(() => {
    ctl.update({ front: inFront(AppState.currentState) });
    const sub = AppState.addEventListener('change', (s) => ctl.update({ front: inFront(s) }));
    return () => sub.remove();
  }, [ctl]);

  useEffect(
    () =>
      watchOfferTaps((id) => {
        // From any screen: back to the home screen, where the popup belongs.
        try {
          if (router.canDismiss()) router.dismissAll();
        } catch {
          /* already home */
        }
        ctl.tap(id);
      }),
    [ctl],
  );

  if (!view) return null;

  const accept = async () => {
    const words = await ctl.accept(onTake);
    if (words !== null) Alert.alert(t.appName, words);
  };

  return (
    <JobPopup
      key={view.offer.id + view.openedAt}
      offer={view.offer}
      raised={view.raised}
      myCity={myCity}
      openedAt={view.openedAt}
      busy={view.busy}
      onAccept={() => void accept()}
      onDismiss={() => ctl.dismiss()}
      onTimeout={() => ctl.dismiss()}
    />
  );
}

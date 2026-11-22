/**
 * Job alerts: the alerts robot sends a push notification (through Expo) to
 * the nearest online drivers when a job offer goes out. The token is saved
 * with his Online status (availability/{driverId}); nothing else uses it.
 * Android needs the Firebase file (google-services.json) in the build for
 * this; without it the app still works, only without alerts.
 *
 * A job alert carries `data: { offerId }`. With the app open, the "New job"
 * popup shows it, so the alert only sounds (no banner over the popup); a tap
 * on the alert opens the app on that offer's popup.
 */

import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { AppState, type AppStateStatus, Platform } from 'react-native';

import { offerIdOf } from '@/data/popup';

/** How a notification shows while the app is running: a job alert in the foreground only sounds. */
export function foregroundBehaviour(data: unknown, appState: AppStateStatus) {
  const popupInstead = offerIdOf(data) !== null && appState === 'active';
  return {
    shouldShowBanner: !popupInstead,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  };
}

export function configureNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async (n) => foregroundBehaviour(n.request.content.data, AppState.currentState),
  });
}

/** Alerts already handled in this run of the app (the cold-start one can also reach the listener). */
const handled = new Set<string>();

function handleTap(response: Notifications.NotificationResponse | null, onOffer: (id: string) => void) {
  if (!response) return;
  const key = response.notification.request.identifier;
  const id = offerIdOf(response.notification.request.content.data);
  if (!id || handled.has(key)) return;
  handled.add(key);
  // So the next launch of the app does not open the same alert again.
  try {
    Notifications.clearLastNotificationResponse();
  } catch {
    /* an older native module: the handled set still covers this run */
  }
  onOffer(id);
}

/**
 * Taps on job alerts → `onOffer(offerId)`: the one that started the app
 * (cold start) and every one while it runs. Returns the unsubscribe.
 */
export function watchOfferTaps(onOffer: (offerId: string) => void): () => void {
  let alive = true;
  const sub = Notifications.addNotificationResponseReceivedListener((r) => handleTap(r, onOffer));
  void Notifications.getLastNotificationResponseAsync()
    .then((r) => alive && handleTap(r, onOffer))
    .catch(() => {});
  return () => {
    alive = false;
    sub.remove();
  };
}

/** The Expo push token for job alerts, or '' when they cannot be set up here. */
export async function jobAlertsToken(channelName: string): Promise<string> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('jobs', {
        name: channelName,
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default',
        vibrationPattern: [0, 400, 200, 400],
      });
    }
    const perm = await Notifications.getPermissionsAsync();
    const granted =
      perm.status === 'granted' ||
      (perm.canAskAgain && (await Notifications.requestPermissionsAsync()).status === 'granted');
    if (!granted) return '';
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    if (!projectId) return '';
    return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch {
    return '';
  }
}

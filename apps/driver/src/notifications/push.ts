/**
 * Job alerts: the alerts robot sends a push notification (through Expo) to
 * the nearest online drivers when a job offer goes out. The token is saved
 * with his Online status (availability/{driverId}); nothing else uses it.
 * Android needs the Firebase file (google-services.json) in the build for
 * this; without it the app still works, only without alerts.
 */

import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export function configureNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
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

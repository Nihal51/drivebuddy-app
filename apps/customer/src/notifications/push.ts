/**
 * Booking updates as phone notifications.
 *
 * The phone asks Expo for a push token and stores it in
 * users/{uid}/devices/{id} with the customer's language. When an admin
 * confirms a booking or assigns a driver on the website, the alerts robot
 * (apps-script/Code.js in the website repo) sends the update to every device of
 * that customer through Expo's push service. Nothing here runs a server.
 *
 * Needs a real phone, a development or store build (not the web preview), and
 * the EAS project id in app.config.ts; without them this quietly reports
 * 'unsupported' and the rest of the app works the same.
 */

import { type Language, deviceDocId } from '@drivebuddy/shared';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Platform } from 'react-native';

import { firestore } from '@/firebase/app';
import { readStored, writeStored } from '@/lib/storage';
import { colors } from '@/theme';

export const CHANNEL_ID = 'bookings';
const TOKEN_KEY = 'db.pushToken';

export type PushState = 'unsupported' | 'off' | 'denied' | 'on';

/** Show updates as a banner even while the app is open. */
export function configureNotificationHandler() {
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

function projectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? undefined;
}

export const isPushSupported = () => Platform.OS !== 'web' && Device.isDevice && Boolean(projectId());

/** Android groups notifications by channel; the name shows in the phone's settings. */
async function ensureChannel(name: string) {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name,
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: colors.amber,
    vibrationPattern: [0, 250, 150, 250],
  });
}

/** Current state without asking the customer anything. */
export async function pushState(): Promise<PushState> {
  if (!isPushSupported()) return 'unsupported';
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return (await readStored(TOKEN_KEY)) ? 'on' : 'off';
  return status === 'denied' && !canAskAgain ? 'denied' : 'off';
}

/**
 * Turn updates on for this customer on this phone: ask permission if `ask`,
 * get the token, store it with the language. Safe to call again — on every
 * login and language change — it just refreshes the same record.
 */
export async function enablePush(
  uid: string,
  language: Language,
  opts: { ask: boolean; channelName: string },
): Promise<PushState> {
  if (!isPushSupported()) return 'unsupported';
  try {
    await ensureChannel(opts.channelName);
    let { status, canAskAgain } = await Notifications.getPermissionsAsync();
    if (status !== 'granted' && opts.ask && canAskAgain) {
      ({ status, canAskAgain } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return canAskAgain ? 'off' : 'denied';

    const token = (await Notifications.getExpoPushTokenAsync({ projectId: projectId() })).data;
    await setDoc(doc(firestore(), 'users', uid, 'devices', deviceDocId(token)), {
      token,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      language,
      updatedAt: serverTimestamp(),
    });
    await writeStored(TOKEN_KEY, token);
    return 'on';
  } catch (err) {
    if (__DEV__) console.warn('[drivebuddy] push registration failed', err);
    return 'off';
  }
}

/** On logout: stop sending this customer's updates to this phone. */
export async function disablePush(uid: string): Promise<void> {
  const token = await readStored(TOKEN_KEY);
  if (!token) return;
  try {
    await deleteDoc(doc(firestore(), 'users', uid, 'devices', deviceDocId(token)));
  } catch {
    /* offline — the robot drops tokens Expo reports as gone */
  }
  await writeStored(TOKEN_KEY, '');
}

/** The booking a tapped notification is about, if any. */
export function bookingIdFrom(
  response: Notifications.NotificationResponse | null | undefined,
): string | null {
  const data = response?.notification.request.content.data as { bookingId?: unknown } | undefined;
  return typeof data?.bookingId === 'string' && /^[A-Za-z0-9]{1,128}$/.test(data.bookingId)
    ? data.bookingId
    : null;
}

/**
 * Live location for the customer, between the driver's tap on Start and his
 * tap on Arrived. Android runs it as a foreground service with a notification
 * that stays on the whole time (no background-location permission: the
 * service is started while the app is open, by his tap). Each fix is written
 * to tracking/{bookingId}; firestore.rules accepts it only from the driver the
 * booking is assigned to and only while it is "assigned", so the moment the
 * office completes or reassigns the job the next write is refused and sharing
 * stops by itself.
 *
 * This file must be imported when the app starts (app/_layout.tsx): Android
 * can wake the JavaScript for the task without opening a screen.
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { PermissionsAndroid, Platform } from 'react-native';

import { firestore } from '@/firebase/app';
import { firebaseAuth } from '@/firebase/auth';
import { readJson, writeJson, writeStored } from '@/lib/storage';

export const LOCATION_TASK = 'dbd-share-location';
const STATE_KEY = 'dbd.sharing';

export type Sharing = {
  bookingId: string;
  phone: string;
  name: string;
  startedAt: number;
  lastSentAt?: number;
};

export type StartResult =
  { ok: true } | { ok: false; reason: 'permission' | 'gps-off' | 'other-job' | 'failed' };

type Fix = Pick<Location.LocationObject, 'coords' | 'timestamp'>;

/** One GPS fix → the fields firestore.rules (isTrack) accepts, without the server time. */
export function trackPoint(fix: Fix, phone: string, name: string) {
  const { latitude, longitude, accuracy, heading, speed } = fix.coords;
  const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;
  return {
    lat: round(latitude, 6),
    lng: round(longitude, 6),
    acc: Math.min(Math.max(Math.round(accuracy ?? 0), 0), 100_000),
    ...(typeof heading === 'number' && heading >= 0 && heading <= 360
      ? { heading: Math.round(heading) }
      : {}),
    ...(typeof speed === 'number' && speed >= 0 && speed <= 100 ? { speed: round(speed, 1) } : {}),
    active: true,
    phoneAt: new Date(fix.timestamp),
    driverPhone: phone,
    ...(name.trim().length >= 2 ? { driverName: name.trim().slice(0, 60) } : {}),
  };
}

/** Fixes outside India (or no fix at all) are not sent: the rules would refuse them anyway. */
export const inIndia = (fix: Fix) =>
  fix.coords.latitude >= 6 &&
  fix.coords.latitude <= 37 &&
  fix.coords.longitude >= 68 &&
  fix.coords.longitude <= 98;

/* ------------------------------------------------------------ listeners */

const listeners = new Set<(s: Sharing | null) => void>();

export function onSharingChange(cb: (s: Sharing | null) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function announce(s: Sharing | null) {
  listeners.forEach((cb) => cb(s));
}

export const currentSharing = () => readJson<Sharing>(STATE_KEY);

/* ------------------------------------------------------------ writing */

const isRefused = (err: unknown) =>
  typeof err === 'object' && err !== null && (err as { code?: string }).code === 'permission-denied';

/** Write the newest fix; stop sharing when the rules say the job is no longer his. */
export async function sendFix(fix: Fix): Promise<void> {
  const s = await currentSharing();
  if (!s || !inIndia(fix)) return;
  const auth = firebaseAuth();
  await auth.authStateReady();
  if (!auth.currentUser) return;
  try {
    await setDoc(doc(firestore(), 'tracking', s.bookingId), {
      ...trackPoint(fix, s.phone, s.name),
      at: serverTimestamp(),
    });
    const next = { ...s, lastSentAt: Date.now() };
    await writeJson(STATE_KEY, next);
    announce(next);
  } catch (err) {
    if (isRefused(err)) await stopSharing({ markEnded: false });
  }
}

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(LOCATION_TASK, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  const newest = data.locations.reduce((a, b) => (b.timestamp > a.timestamp ? b : a));
  await sendFix(newest);
});

/* ------------------------------------------------------------ start / stop */

async function askNotifications() {
  // Android 13+: without this the sharing notification is hidden (sharing still works).
  if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
    await PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS').catch(() => null);
  }
}

export async function startSharing(
  job: { id: string },
  driver: { phone: string; name: string },
  notification: { title: string; body: string },
): Promise<StartResult> {
  try {
    const already = await currentSharing();
    if (already && already.bookingId !== job.id && (await isRunning()))
      return { ok: false, reason: 'other-job' };

    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return { ok: false, reason: 'permission' };
    if (!(await Location.hasServicesEnabledAsync())) return { ok: false, reason: 'gps-off' };
    await askNotifications();

    const state: Sharing = {
      bookingId: job.id,
      phone: driver.phone,
      name: driver.name,
      startedAt: Date.now(),
    };
    await writeJson(STATE_KEY, state);
    announce(state);

    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: 15_000,
      distanceInterval: 25,
      deferredUpdatesInterval: 15_000,
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.AutomotiveNavigation,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: notification.title,
        notificationBody: notification.body,
        notificationColor: '#F59E0B',
        killServiceOnDestroy: false,
      },
    });

    // The customer sees the driver straight away, not after the first 15 seconds.
    const now = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }).catch(
      () => null,
    );
    if (now) await sendFix(now);
    return { ok: true };
  } catch {
    await stopSharing({ markEnded: false }).catch(() => {});
    return { ok: false, reason: 'failed' };
  }
}

async function isRunning(): Promise<boolean> {
  return Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
}

/**
 * Arrived (or logged out, or the job is no longer his). The customer's map
 * shows the driver as arrived: the last point stays, marked inactive.
 */
export async function stopSharing(opts: { markEnded?: boolean } = {}): Promise<void> {
  const s = await currentSharing();
  if (await isRunning()) await Location.stopLocationUpdatesAsync(LOCATION_TASK).catch(() => {});
  await writeStored(STATE_KEY, '');
  announce(null);
  if (s && opts.markEnded !== false) {
    await updateDoc(doc(firestore(), 'tracking', s.bookingId), {
      active: false,
      at: serverTimestamp(),
      phoneAt: new Date(),
    }).catch(() => {});
  }
}

/** At launch: a sharing note left behind without the service running (phone restarted) is cleared. */
export async function tidySharing(): Promise<Sharing | null> {
  const s = await currentSharing();
  if (s && !(await isRunning())) {
    await writeStored(STATE_KEY, '');
    return null;
  }
  return s;
}

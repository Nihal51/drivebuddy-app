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
  await sendOnline(newest);
});

/* ------------------------------------------------------------ online */

/**
 * "Online" for job offers: while it is on, availability/{driverId} gets his
 * spot about every 2 minutes and his phone's push token, so the alerts robot
 * sends a new job to the nearest online drivers first. One location service
 * does both: every 15 s while sharing on a job, every 2 min while only online.
 */
export type Online = {
  driverId: string;
  city: string;
  name: string;
  phone: string;
  token: string;
  lastAt?: number;
};

const ONLINE_KEY = 'dbd.online';
const SERVICE_TEXT_KEY = 'dbd.serviceText';
const ONLINE_EVERY_MS = 110_000;

export const currentOnline = () => readJson<Online>(ONLINE_KEY);

const onlineListeners = new Set<(o: Online | null) => void>();
export function onOnlineChange(cb: (o: Online | null) => void): () => void {
  onlineListeners.add(cb);
  return () => onlineListeners.delete(cb);
}

async function writeAvailability(o: Online, online: boolean, fix?: Fix | null) {
  const spot =
    fix && inIndia(fix)
      ? {
          lat: Math.round(fix.coords.latitude * 1e5) / 1e5,
          lng: Math.round(fix.coords.longitude * 1e5) / 1e5,
          acc: Math.min(Math.max(Math.round(fix.coords.accuracy ?? 0), 0), 100_000),
        }
      : {};
  await setDoc(doc(firestore(), 'availability', o.driverId), {
    online,
    city: o.city,
    name: o.name,
    phone: o.phone,
    ...(online ? spot : {}),
    ...(online && o.token ? { pushToken: o.token } : {}),
    at: serverTimestamp(),
  });
}

/** A fix while online: tell the robot where he is, at most every ~2 minutes. */
export async function sendOnline(fix: Fix): Promise<void> {
  const o = await currentOnline();
  if (!o || (o.lastAt && Date.now() - o.lastAt < ONLINE_EVERY_MS)) return;
  const auth = firebaseAuth();
  await auth.authStateReady();
  if (!auth.currentUser) return;
  try {
    await writeAvailability(o, true, fix);
    const next = { ...o, lastAt: Date.now() };
    await writeJson(ONLINE_KEY, next);
    onlineListeners.forEach((cb) => cb(next));
  } catch (err) {
    // No longer Active (or another city): go offline quietly.
    if (isRefused(err)) await goOffline({ write: false });
  }
}

type ServiceText = { sharing: { title: string; body: string }; online: { title: string; body: string } };

/** Start, change or stop the one location service to fit what is on: sharing (15 s), online (2 min), nothing. */
async function applyMode(): Promise<void> {
  const [sharing, online, text] = await Promise.all([
    currentSharing(),
    currentOnline(),
    readJson<ServiceText>(SERVICE_TEXT_KEY),
  ]);
  if (!sharing && !online) {
    if (await isRunning()) await Location.stopLocationUpdatesAsync(LOCATION_TASK).catch(() => {});
    return;
  }
  const t = sharing ? text?.sharing : text?.online;
  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: sharing ? Location.Accuracy.High : Location.Accuracy.Balanced,
    timeInterval: sharing ? 15_000 : 120_000,
    distanceInterval: sharing ? 25 : 150,
    deferredUpdatesInterval: sharing ? 15_000 : 120_000,
    pausesUpdatesAutomatically: false,
    activityType: Location.ActivityType.AutomotiveNavigation,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: t?.title ?? 'DriveBuddy Driver',
      notificationBody: t?.body ?? '',
      notificationColor: '#F59E0B',
      killServiceOnDestroy: false,
    },
  });
}

export type OnlineResult =
  { ok: true; alerts: boolean } | { ok: false; reason: 'permission' | 'gps-off' | 'failed' };

/** Go online for job offers. `pushToken` is '' when job alerts cannot be set up on this phone. */
export async function goOnline(
  me: { driverId: string; city: string; name: string; phone: string },
  pushToken: string,
  text: ServiceText,
): Promise<OnlineResult> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return { ok: false, reason: 'permission' };
    if (!(await Location.hasServicesEnabledAsync())) return { ok: false, reason: 'gps-off' };
    await askNotifications();
    await writeJson(SERVICE_TEXT_KEY, text);
    const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(
      () => null,
    );
    const o: Online = { ...me, token: pushToken, lastAt: Date.now() };
    await writeAvailability(o, true, fix);
    await writeJson(ONLINE_KEY, o);
    onlineListeners.forEach((cb) => cb(o));
    await applyMode();
    return { ok: true, alerts: Boolean(pushToken) };
  } catch {
    await goOffline().catch(() => {});
    return { ok: false, reason: 'failed' };
  }
}

export async function goOffline(opts: { write?: boolean } = {}): Promise<void> {
  const o = await currentOnline();
  await writeStored(ONLINE_KEY, '');
  onlineListeners.forEach((cb) => cb(null));
  if (o && opts.write !== false) await writeAvailability(o, false).catch(() => {});
  await applyMode().catch(() => {});
}

/** At launch: "online" left behind without the service running (phone restarted) is cleared. */
export async function tidyOnline(): Promise<Online | null> {
  const o = await currentOnline();
  if (o && !(await isRunning())) {
    await writeStored(ONLINE_KEY, '');
    await writeAvailability(o, false).catch(() => {});
    return null;
  }
  return o;
}

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

    const saved = (await readJson<ServiceText>(SERVICE_TEXT_KEY)) ?? {
      online: notification,
      sharing: notification,
    };
    await writeJson(SERVICE_TEXT_KEY, { ...saved, sharing: notification });
    await applyMode();

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
  await writeStored(STATE_KEY, '');
  announce(null);
  // Still online for jobs: the service carries on at the slower pace.
  await applyMode().catch(() => {});
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

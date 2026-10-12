import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';

import { bookingIdFrom } from '@/notifications/push';

/**
 * Tapping a "Driver assigned" notification opens that booking — whether the
 * app was open, in the background, or closed (cold start).
 */
export function NotificationRouter() {
  const last = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    const id = bookingIdFrom(last);
    const key = last ? `${last.notification.request.identifier}:${id}` : null;
    if (!id || !key || handled.current === key) return;
    handled.current = key;
    router.push({ pathname: '/booking/[id]', params: { id } });
  }, [last]);

  return null;
}

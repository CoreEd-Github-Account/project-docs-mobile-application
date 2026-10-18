import { Vibration, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
import type { TaskNotification } from './types';

const SEEN_NOTIFICATIONS_KEY = '@project_docs_seen_notification_ids';

let watcherTimer: ReturnType<typeof setInterval> | null = null;
let isWatcherRunning = false;

// Notification listeners for UI banners
type NotificationListener = (notification: TaskNotification) => void;
type CountListener = (unreadCount: number) => void;

const notificationListeners = new Set<NotificationListener>();
const countListeners = new Set<CountListener>();

export function subscribeToPushNotifications(listener: NotificationListener) {
  notificationListeners.add(listener);
  return () => {
    notificationListeners.delete(listener);
  };
}

export function subscribeToUnreadCount(listener: CountListener) {
  countListeners.add(listener);
  return () => {
    countListeners.delete(listener);
  };
}

export async function getSeenNotificationIds(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(SEEN_NOTIFICATIONS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

export async function markNotificationAsSeenLocally(id: string) {
  try {
    const seen = await getSeenNotificationIds();
    seen.add(id);
    const arr = Array.from(seen).slice(-200); // keep last 200
    await AsyncStorage.setItem(SEEN_NOTIFICATIONS_KEY, JSON.stringify(arr));
  } catch {
    // ignore
  }
}

/**
 * Trigger mobile push notification banner + vibration
 */
export function dispatchPushNotification(notification: TaskNotification) {
  // 1. Physical vibration feedback on phone
  try {
    if (Platform.OS !== 'web') {
      Vibration.vibrate([0, 150, 80, 150]);
    }
  } catch {
    // ignore
  }

  // 2. Notify banner UI subscribers
  notificationListeners.forEach((listener) => {
    try {
      listener(notification);
    } catch (e) {
      console.warn('Notification listener error:', e);
    }
  });
}

/**
 * Live notification watcher: Periodically checks for project notifications
 * and triggers immediate push notification banners when other members update tasks.
 */
export function startNotificationWatcher(
  onUpdate?: (notifications: TaskNotification[], unreadCount: number) => void
) {
  if (isWatcherRunning) return;
  isWatcherRunning = true;

  const poll = async () => {
    try {
      const user = await api.getCachedUser();
      if (!user) return;

      const res = await api.getNotifications();
      const list = res.notifications || [];
      const unreadCount = res.unreadCount || 0;

      if (onUpdate) {
        onUpdate(list, unreadCount);
      }
      countListeners.forEach((l) => l(unreadCount));

      // Check for any unread notification not seen yet
      const seen = await getSeenNotificationIds();
      for (const item of list) {
        if (!item.isRead && !seen.has(item.id)) {
          await markNotificationAsSeenLocally(item.id);
          dispatchPushNotification(item);
        }
      }
    } catch {
      // quiet poll failures
    }
  };

  // Run initial check
  poll();

  // Poll every 6 seconds for live real-time sync
  watcherTimer = setInterval(poll, 6000);
}

export function stopNotificationWatcher() {
  if (watcherTimer) {
    clearInterval(watcherTimer);
    watcherTimer = null;
  }
  isWatcherRunning = false;
}

import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { AuthScreen } from '@/components/AuthScreen';
import { api } from '@/services/api';
import type { TaskNotification } from '@/services/types';

function formatRelativeTime(dateString: string): string {
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const diffMs = Date.now() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateString;
  }
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [notifications, setNotifications] = useState<TaskNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const loadNotifications = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const res = await api.getNotifications();
      setNotifications(res.notifications || []);
      setUnreadCount(res.unreadCount || 0);
    } catch (e: any) {
      console.warn('Failed to load notifications:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadNotifications();
      const interval = setInterval(() => loadNotifications(true), 8000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, loadNotifications]);

  const onRefresh = () => {
    setRefreshing(true);
    loadNotifications(true);
  };

  const handleToggleRead = async (item: TaskNotification) => {
    const nextIsRead = !item.isRead;
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, isRead: nextIsRead } : n))
    );
    setUnreadCount((c) => Math.max(0, nextIsRead ? c - 1 : c + 1));

    try {
      if (nextIsRead) {
        await api.markNotificationRead(item.id);
      } else {
        await api.markNotificationUnread(item.id);
      }
    } catch (err: any) {
      console.warn('Failed to update notification read status:', err.message);
    }
  };

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);

    try {
      await api.markAllNotificationsRead();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const handleDelete = (item: TaskNotification) => {
    setNotifications((prev) => prev.filter((n) => n.id !== item.id));
    if (!item.isRead) {
      setUnreadCount((c) => Math.max(0, c - 1));
    }

    try {
      api.deleteNotification(item.id);
    } catch (err: any) {
      console.warn('Failed to delete notification:', err.message);
    }
  };

  const handleClearAll = () => {
    if (notifications.length === 0) return;
    Alert.alert('Clear All Notifications', 'Are you sure you want to clear all notifications?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear All',
        style: 'destructive',
        onPress: async () => {
          setNotifications([]);
          setUnreadCount(0);
          try {
            await api.clearAllNotifications();
          } catch (err: any) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  };

  if (authLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  const filteredList = notifications.filter((n) => {
    if (filter === 'unread') return !n.isRead;
    return true;
  });

  const getNotificationIconInfo = (type: string) => {
    switch (type) {
      case 'task_created':
        return { name: 'add-circle', color: '#10b981', bg: '#064e3b' };
      case 'task_status_changed':
        return { name: 'swap-horizontal', color: '#38bdf8', bg: '#082f49' };
      case 'task_comment':
      case 'task_subcomment':
        return { name: 'chatbubble-ellipses', color: '#f59e0b', bg: '#451a03' };
      case 'task_deleted':
        return { name: 'trash', color: '#f87171', bg: '#451a1a' };
      default:
        return { name: 'notifications', color: '#818cf8', bg: '#1e1b4b' };
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={styles.bellIconContainer}>
            <Ionicons name="notifications" size={20} color="#38bdf8" />
            {unreadCount > 0 ? (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            ) : null}
          </View>
          <View>
            <Text style={styles.headerTitle}>Notifications</Text>
            <Text style={styles.headerSubtitle}>Project Task Activity & Alerts</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {unreadCount > 0 ? (
            <TouchableOpacity style={styles.markAllBtn} onPress={handleMarkAllRead}>
              <Ionicons name="checkmark-done" size={16} color="#38bdf8" />
              <Text style={styles.markAllBtnText}>Read All</Text>
            </TouchableOpacity>
          ) : null}

          {notifications.length > 0 ? (
            <TouchableOpacity style={styles.clearBtn} onPress={handleClearAll}>
              <Ionicons name="trash-outline" size={16} color="#94a3b8" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterTabs}>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterTabText, filter === 'all' && styles.filterTabTextActive]}>
            All ({notifications.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterTab, filter === 'unread' && styles.filterTabActive]}
          onPress={() => setFilter('unread')}
        >
          <Text style={[styles.filterTabText, filter === 'unread' && styles.filterTabTextActive]}>
            Unread ({unreadCount})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Notifications List */}
      <FlatList
        data={filteredList}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="small" color="#2563eb" style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="notifications-off-outline" size={42} color="#64748b" />
              </View>
              <Text style={styles.emptyTitle}>
                {filter === 'unread' ? 'No Unread Notifications' : 'No Notifications Yet'}
              </Text>
              <Text style={styles.emptySubtitle}>
                Whenever project members create, update, delete, or comment on tasks, you will be notified immediately!
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const icon = getNotificationIconInfo(item.type);

          return (
            <TouchableOpacity
              style={[styles.notifCard, !item.isRead && styles.notifCardUnread]}
              activeOpacity={0.85}
              onPress={() => handleToggleRead(item)}
            >
              {/* Type Icon */}
              <View style={[styles.iconCircle, { backgroundColor: icon.bg }]}>
                <Ionicons name={icon.name as any} size={18} color={icon.color} />
              </View>

              {/* Main Content */}
              <View style={styles.notifBody}>
                <View style={styles.notifTopRow}>
                  {item.projectName ? (
                    <View style={styles.projectBadge}>
                      <Ionicons name="folder-outline" size={11} color="#38bdf8" />
                      <Text style={styles.projectBadgeText} numberOfLines={1}>
                        {item.projectName}
                      </Text>
                    </View>
                  ) : null}

                  <Text style={styles.timeText}>{formatRelativeTime(item.createdAt)}</Text>
                </View>

                <Text style={[styles.notifTitle, !item.isRead && styles.notifTitleUnread]}>
                  {item.title}
                </Text>

                <Text style={styles.notifMessage} numberOfLines={3} selectable>
                  {item.message}
                </Text>
              </View>

              {/* Right Controls */}
              <View style={styles.notifActions}>
                {!item.isRead ? <View style={styles.unreadDot} /> : null}

                <TouchableOpacity
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleDelete(item);
                  }}
                  style={{ marginTop: !item.isRead ? 8 : 0 }}
                >
                  <Ionicons name="close" size={16} color="#64748b" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  bellIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  headerBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 1,
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0f274a',
    borderWidth: 1,
    borderColor: '#2563eb',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  markAllBtnText: {
    fontSize: 12,
    color: '#38bdf8',
    fontWeight: '700',
  },
  clearBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  filterTabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 8,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  filterTabActive: {
    backgroundColor: '#0c2e4e',
    borderColor: '#0284c7',
  },
  filterTabText: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '600',
  },
  filterTabTextActive: {
    color: '#38bdf8',
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 30,
    gap: 10,
  },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 12,
  },
  notifCardUnread: {
    backgroundColor: '#14213d',
    borderColor: '#2563eb',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  notifBody: {
    flex: 1,
  },
  notifTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  projectBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0f172a',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    maxWidth: 160,
  },
  projectBadgeText: {
    fontSize: 11,
    color: '#38bdf8',
    fontWeight: '700',
  },
  timeText: {
    fontSize: 11,
    color: '#64748b',
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#cbd5e1',
    marginBottom: 2,
  },
  notifTitleUnread: {
    color: '#ffffff',
    fontWeight: '800',
  },
  notifMessage: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 18,
  },
  notifActions: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#38bdf8',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 30,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#e2e8f0',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
});

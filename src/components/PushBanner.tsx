import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { subscribeToPushNotifications } from '@/services/notifications';
import type { TaskNotification } from '@/services/types';

export function PushNotificationBanner() {
  const router = useRouter();
  const [currentNotif, setCurrentNotif] = useState<TaskNotification | null>(null);
  const translateY = useRef(new Animated.Value(-160)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToPushNotifications((notif) => {
      if (dismissTimer.current) {
        clearTimeout(dismissTimer.current);
      }

      setCurrentNotif(notif);

      // Animate in from top
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 70,
          friction: 9,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto dismiss after 5 seconds
      dismissTimer.current = setTimeout(() => {
        dismissBanner();
      }, 5000);
    });

    return () => {
      unsubscribe();
      if (dismissTimer.current) {
        clearTimeout(dismissTimer.current);
      }
    };
  }, []);

  const dismissBanner = () => {
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -160,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCurrentNotif(null);
    });
  };

  const handlePress = () => {
    dismissBanner();
    router.push('/notifications');
  };

  if (!currentNotif) return null;

  const getIconInfo = (type: string) => {
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

  const icon = getIconInfo(currentNotif.type);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY }],
          opacity,
        },
      ]}
      pointerEvents="box-none"
    >
      <SafeAreaView edges={['top']} style={{ width: '100%', alignItems: 'center' }}>
        <TouchableOpacity
          style={styles.bannerCard}
          activeOpacity={0.92}
          onPress={handlePress}
        >
          {/* Left Icon Circle */}
          <View style={[styles.iconBox, { backgroundColor: icon.bg }]}>
            <Ionicons name={icon.name as any} size={18} color={icon.color} />
          </View>

          {/* Banner Text Content */}
          <View style={styles.textContent}>
            <View style={styles.topRow}>
              {currentNotif.projectName ? (
                <Text style={styles.projectTag} numberOfLines={1}>
                  {currentNotif.projectName}
                </Text>
              ) : null}
              <Text style={styles.timeTag}>Just now</Text>
            </View>

            <Text style={styles.title} numberOfLines={1}>
              {currentNotif.title}
            </Text>

            <Text style={styles.message} numberOfLines={2}>
              {currentNotif.message}
            </Text>
          </View>

          {/* Dismiss button */}
          <TouchableOpacity
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={dismissBanner}
            style={styles.closeBtn}
          >
            <Ionicons name="close" size={18} color="#94a3b8" />
          </TouchableOpacity>
        </TouchableOpacity>
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 99999,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  bannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#38bdf8',
    width: '100%',
    maxWidth: 480,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 10,
    gap: 12,
    marginTop: Platform.OS === 'android' ? 8 : 4,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContent: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  projectTag: {
    fontSize: 11,
    color: '#38bdf8',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeTag: {
    fontSize: 10,
    color: '#64748b',
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 2,
  },
  message: {
    fontSize: 12,
    color: '#cbd5e1',
    lineHeight: 16,
  },
  closeBtn: {
    padding: 4,
  },
});

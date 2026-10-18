import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { AuthScreen } from '@/components/AuthScreen';
import { api, getDefaultApiUrl, PRODUCTION_API_URL } from '@/services/api';

export default function ProfileScreen() {
  const { isAuthenticated, isLoading: authLoading, user, logout, apiUrl, setApiUrl } = useAuth();
  const [serverUrl, setServerUrl] = useState(apiUrl);
  const [pingResult, setPingResult] = useState<string | null>(null);
  const [pinging, setPinging] = useState(false);

  const handleSaveUrl = async () => {
    try {
      await setApiUrl(serverUrl);
      Alert.alert('Saved', `Backend API URL updated to:\n${serverUrl}`);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handlePing = async () => {
    setPinging(true);
    setPingResult('Pinging server...');
    try {
      const startTime = Date.now();
      const res = await api.testConnection(serverUrl);
      const latency = Date.now() - startTime;
      if (res.ok) {
        setPingResult(`Connected! (${latency}ms latency)`);
      } else {
        setPingResult(`Failed: ${res.message}`);
      }
    } catch (e: any) {
      setPingResult(`Connection error: ${e.message}`);
    } finally {
      setPinging(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out of this workspace?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
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

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Account & Settings</Text>
          <Text style={styles.headerSubtitle}>Manage your profile and backend links</Text>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitial}>
              {(user?.fullName || user?.username || 'U').charAt(0).toUpperCase()}
            </Text>
          </View>

          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.fullName || user?.username}</Text>
            <Text style={styles.profileUsername}>@{user?.username}</Text>
            {user?.email ? <Text style={styles.profileEmail}>{user.email}</Text> : null}
          </View>
        </View>

        {/* Backend & Server Connection Card */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHead}>
            <Ionicons name="server-outline" size={20} color="#38bdf8" />
            <Text style={styles.sectionTitle}>Backend Server Configuration</Text>
          </View>

          <Text style={styles.sectionSubtitle}>
            Target URL for the Next.js API server (`web-application`):
          </Text>

          <TextInput
            style={styles.urlInput}
            value={serverUrl}
            onChangeText={setServerUrl}
            autoCapitalize="none"
            autoCorrect={false}
          />

          {/* Preset Buttons */}
          <View style={styles.presetsRow}>
            <TouchableOpacity
              style={[styles.presetChip, { backgroundColor: '#0284c7' }]}
              onPress={() => setServerUrl(PRODUCTION_API_URL)}
            >
              <Text style={[styles.presetChipText, { color: '#ffffff', fontWeight: 'bold' }]}>Vercel Cloud (Production)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.presetChip}
              onPress={() => setServerUrl('http://localhost:3000')}
            >
              <Text style={styles.presetChipText}>Localhost</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.presetChip}
              onPress={() => setServerUrl('http://10.0.2.2:3000')}
            >
              <Text style={styles.presetChipText}>Android (10.0.2.2)</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveUrl}>
              <Ionicons name="save-outline" size={16} color="#ffffff" />
              <Text style={styles.saveBtnText}>Save URL</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.pingBtn, pinging && { opacity: 0.6 }]}
              onPress={handlePing}
              disabled={pinging}
            >
              {pinging ? (
                <ActivityIndicator size="small" color="#38bdf8" />
              ) : (
                <>
                  <Ionicons name="pulse-outline" size={16} color="#38bdf8" />
                  <Text style={styles.pingBtnText}>Test Ping</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {pingResult ? (
            <View
              style={[
                styles.pingBox,
                pingResult.includes('Connected') ? styles.pingBoxSuccess : styles.pingBoxError,
              ]}
            >
              <Ionicons
                name={pingResult.includes('Connected') ? 'checkmark-circle' : 'alert-circle'}
                size={16}
                color={pingResult.includes('Connected') ? '#4ade80' : '#f87171'}
              />
              <Text
                style={[
                  styles.pingResultText,
                  pingResult.includes('Connected') ? styles.pingTextSuccess : styles.pingTextError,
                ]}
              >
                {pingResult}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Database Status Card */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHead}>
            <Ionicons name="cube-outline" size={20} color="#10b981" />
            <Text style={styles.sectionTitle}>Database & Infrastructure</Text>
          </View>

          <View style={styles.infraGrid}>
            <View style={styles.infraRow}>
              <Text style={styles.infraLabel}>Database Engine:</Text>
              <Text style={styles.infraValue}>PostgreSQL 15 (Supabase)</Text>
            </View>
            <View style={styles.infraRow}>
              <Text style={styles.infraLabel}>Connection Pooler:</Text>
              <Text style={styles.infraValue}>aws-0-ap-southeast-2 (SSL)</Text>
            </View>
            <View style={styles.infraRow}>
              <Text style={styles.infraLabel}>Data Sync:</Text>
              <Text style={styles.infraValue}>Real-Time REST API</Text>
            </View>
            <View style={styles.infraRow}>
              <Text style={styles.infraLabel}>Session Token:</Text>
              <Text style={styles.infraValue}>HS256 Bearer JWT</Text>
            </View>
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#f87171" />
          <Text style={styles.logoutBtnText}>Sign Out of Workspace</Text>
        </TouchableOpacity>
      </ScrollView>
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 90,
    gap: 16,
  },
  header: {
    paddingBottom: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#f8fafc',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 14,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 26,
    fontWeight: '800',
    color: '#ffffff',
  },
  profileInfo: {
    flex: 1,
    gap: 2,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f8fafc',
  },
  profileUsername: {
    fontSize: 13,
    color: '#38bdf8',
    fontWeight: '600',
  },
  profileEmail: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  sectionCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 12,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f8fafc',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
  },
  urlInput: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12,
    height: 44,
    color: '#f8fafc',
    fontSize: 13,
    fontFamily: 'monospace',
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  presetChip: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  presetChipText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2563eb',
    height: 42,
    borderRadius: 10,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  pingBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#38bdf8',
    height: 42,
    borderRadius: 10,
  },
  pingBtnText: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '700',
  },
  pingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  pingBoxSuccess: {
    backgroundColor: '#064e3b',
    borderColor: '#059669',
  },
  pingBoxError: {
    backgroundColor: '#451a1a',
    borderColor: '#b91c1c',
  },
  pingResultText: {
    fontSize: 12,
    fontWeight: '600',
  },
  pingTextSuccess: {
    color: '#4ade80',
  },
  pingTextError: {
    color: '#f87171',
  },
  infraGrid: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  infraRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infraLabel: {
    fontSize: 12,
    color: '#94a3b8',
  },
  infraValue: {
    fontSize: 12,
    color: '#f8fafc',
    fontWeight: '600',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#7f1d1d',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 6,
  },
  logoutBtnText: {
    color: '#f87171',
    fontSize: 15,
    fontWeight: '700',
  },
});

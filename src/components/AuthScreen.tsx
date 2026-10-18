import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { api, getDefaultApiUrl, PRODUCTION_API_URL } from '@/services/api';

export function AuthScreen() {
  const { login, register, apiUrl, setApiUrl } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [customUrl, setCustomUrl] = useState(apiUrl);
  const [pingStatus, setPingStatus] = useState<string | null>(null);
  const [testingPing, setTestingPing] = useState(false);

  const handleSubmit = async () => {
    if (!username.trim() || !password.trim()) {
      setErrorMessage('Please fill in both username and password.');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    try {
      if (isRegister) {
        await register(username.trim(), password, email.trim() || undefined);
      } else {
        await login(username.trim(), password);
      }
    } catch (err: any) {
      const rawMsg = err.message || '';
      if (
        rawMsg.toLowerCase().includes('failed') ||
        rawMsg.toLowerCase().includes('canceled') ||
        rawMsg.toLowerCase().includes('network') ||
        rawMsg.toLowerCase().includes('timed out')
      ) {
        setErrorMessage(
          `Cannot reach backend at ${apiUrl}.\n\nPlease ensure you have an active internet connection or switch to the Vercel Cloud server (${PRODUCTION_API_URL}) below.`
        );
      } else {
        setErrorMessage(rawMsg || 'Authentication failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingPing(true);
    setPingStatus('Testing connection...');
    try {
      const res = await api.testConnection(customUrl);
      setPingStatus(res.ok ? `Connected! (${customUrl})` : res.message);
    } catch (err: any) {
      setPingStatus(`Error: ${err.message}`);
    } finally {
      setTestingPing(false);
    }
  };

  const handleSaveUrl = async () => {
    try {
      await setApiUrl(customUrl);
      Alert.alert('Backend Updated', `Server URL set to:\n${customUrl}`);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const fillDemoAccount = (u: string, p: string = 'password') => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Logo & Header */}
        <View style={styles.brandContainer}>
          <View style={styles.logoBadge}>
            <Ionicons name="documents-outline" size={38} color="#2563eb" />
          </View>
          <Text style={styles.appTitle}>Project Docs</Text>
          <Text style={styles.appSubtitle}>Mobile Workspace & Task Manager</Text>
        </View>

        {/* Auth Mode Switcher */}
        <View style={styles.tabSwitcher}>
          <TouchableOpacity
            style={[styles.switchTab, !isRegister && styles.activeSwitchTab]}
            onPress={() => {
              setIsRegister(false);
              setErrorMessage('');
            }}
          >
            <Text style={[styles.switchTabText, !isRegister && styles.activeSwitchTabText]}>
              Sign In
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.switchTab, isRegister && styles.activeSwitchTab]}
            onPress={() => {
              setIsRegister(true);
              setErrorMessage('');
            }}
          >
            <Text style={[styles.switchTabText, isRegister && styles.activeSwitchTabText]}>
              Create Account
            </Text>
          </TouchableOpacity>
        </View>

        {/* Error message */}
        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={18} color="#dc2626" />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {/* Inputs Form */}
        <View style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Username</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={20} color="#6b7280" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter your username"
                placeholderTextColor="#9ca3af"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {isRegister && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email (optional)</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="mail-outline" size={20} color="#6b7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="name@example.com"
                  placeholderTextColor="#9ca3af"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color="#6b7280" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter password"
                placeholderTextColor="#9ca3af"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitButtonText}>
                {isRegister ? 'Register & Enter' : 'Sign In to Workspace'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Quick Demo Switcher */}
        <View style={styles.demoSection}>
          <Text style={styles.demoHeader}>Quick Fill Demo User:</Text>
          <View style={styles.demoPills}>
            <TouchableOpacity style={styles.demoPill} onPress={() => fillDemoAccount('testmobile', 'password123')}>
              <Text style={styles.demoPillText}>testmobile</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.demoPill} onPress={() => fillDemoAccount('admin', 'admin123')}>
              <Text style={styles.demoPillText}>admin</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.demoPill} onPress={() => fillDemoAccount('ubaid', 'password')}>
              <Text style={styles.demoPillText}>ubaid</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Server Config Collapsible */}
        <View style={styles.configCard}>
          <TouchableOpacity
            style={styles.configToggle}
            onPress={() => setShowConfig(!showConfig)}
          >
            <View style={styles.configToggleLeft}>
              <Ionicons name="server-outline" size={18} color="#4b5563" />
              <Text style={styles.configToggleText}>Backend Server Settings</Text>
            </View>
            <Ionicons
              name={showConfig ? 'chevron-up' : 'chevron-down'}
              size={18}
              color="#4b5563"
            />
          </TouchableOpacity>

          {showConfig && (
            <View style={styles.configBody}>
              <Text style={styles.configHelp}>
                Ensure Next.js backend (`web-application`) is running on your machine:
              </Text>
              <TextInput
                style={styles.configInput}
                value={customUrl}
                onChangeText={setCustomUrl}
                placeholder="http://localhost:3000"
                placeholderTextColor="#9ca3af"
                autoCapitalize="none"
              />

              <View style={styles.presetsRow}>
                <TouchableOpacity
                  style={[styles.presetChip, { backgroundColor: '#0284c7' }]}
                  onPress={() => setCustomUrl(PRODUCTION_API_URL)}
                >
                  <Text style={[styles.presetChipText, { color: '#ffffff', fontWeight: 'bold' }]}>Vercel Cloud (Production)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => setCustomUrl('http://192.168.100.45:3000')}
                >
                  <Text style={styles.presetChipText}>Laptop Wi-Fi</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => setCustomUrl('http://localhost:3000')}
                >
                  <Text style={styles.presetChipText}>Localhost</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.configActions}>
                <TouchableOpacity
                  style={[styles.configBtn, styles.saveBtn]}
                  onPress={handleSaveUrl}
                >
                  <Text style={styles.saveBtnText}>Save URL</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.configBtn, styles.testBtn]}
                  onPress={handleTestConnection}
                  disabled={testingPing}
                >
                  {testingPing ? (
                    <ActivityIndicator size="small" color="#2563eb" />
                  ) : (
                    <Text style={styles.testBtnText}>Test Ping</Text>
                  )}
                </TouchableOpacity>
              </View>

              {pingStatus ? (
                <Text
                  style={[
                    styles.pingResult,
                    pingStatus.includes('Connected') ? styles.pingSuccess : styles.pingError,
                  ]}
                >
                  {pingStatus}
                </Text>
              ) : null}
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
    alignItems: 'center',
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#f8fafc',
    letterSpacing: -0.5,
  },
  appSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 4,
  },
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 4,
    width: '100%',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  switchTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  activeSwitchTab: {
    backgroundColor: '#2563eb',
  },
  switchTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
  },
  activeSwitchTabText: {
    color: '#ffffff',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#451a1a',
    borderWidth: 1,
    borderColor: '#7f1d1d',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    width: '100%',
    gap: 8,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 13,
    flex: 1,
  },
  formContainer: {
    width: '100%',
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#cbd5e1',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 48,
    color: '#f8fafc',
    fontSize: 15,
  },
  submitButton: {
    backgroundColor: '#2563eb',
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  demoSection: {
    marginTop: 20,
    width: '100%',
    alignItems: 'center',
  },
  demoHeader: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 8,
  },
  demoPills: {
    flexDirection: 'row',
    gap: 8,
  },
  demoPill: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  demoPillText: {
    color: '#93c5fd',
    fontSize: 12,
    fontWeight: '600',
  },
  configCard: {
    width: '100%',
    backgroundColor: '#1e293b',
    borderRadius: 14,
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  configToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  configToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  configToggleText: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '600',
  },
  configBody: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    gap: 10,
  },
  configHelp: {
    fontSize: 12,
    color: '#64748b',
  },
  configInput: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    height: 42,
    paddingHorizontal: 12,
    color: '#f8fafc',
    fontSize: 13,
  },
  configActions: {
    flexDirection: 'row',
    gap: 8,
  },
  configBtn: {
    flex: 1,
    height: 38,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtn: {
    backgroundColor: '#334155',
  },
  saveBtnText: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '600',
  },
  testBtn: {
    backgroundColor: '#1e3a8a',
  },
  testBtnText: {
    color: '#93c5fd',
    fontSize: 13,
    fontWeight: '600',
  },
  pingResult: {
    fontSize: 12,
    marginTop: 4,
  },
  pingSuccess: {
    color: '#4ade80',
  },
  pingError: {
    color: '#f87171',
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
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
    color: '#93c5fd',
    fontWeight: '600',
  },
});

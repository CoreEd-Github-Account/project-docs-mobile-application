import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '@/context/AuthContext';
import { AuthScreen } from '@/components/AuthScreen';
import { api } from '@/services/api';
import type { Subscription, PasswordItem, SavedPrompt } from '@/services/types';

export default function VaultScreen() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'subs' | 'pass' | 'prompts'>('subs');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Copy feedback state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyText = async (id: string, text: string) => {
    await Clipboard.setStringAsync(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Data states
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [passwords, setPasswords] = useState<PasswordItem[]>([]);
  const [prompts, setPrompts] = useState<SavedPrompt[]>([]);

  // Password visibility map { [id]: boolean }
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  // Modals
  const [subModal, setSubModal] = useState(false);
  const [subName, setSubName] = useState('');
  const [subAmount, setSubAmount] = useState('');
  const [subRenewalDate, setSubRenewalDate] = useState(new Date().toISOString().split('T')[0]);

  const [passModal, setPassModal] = useState(false);
  const [passProjectName, setPassProjectName] = useState('');
  const [passUrl, setPassUrl] = useState('');
  const [passIdentifier, setPassIdentifier] = useState('');
  const [passSecret, setPassSecret] = useState('');

  const [promptModal, setPromptModal] = useState(false);
  const [promptHeading, setPromptHeading] = useState('');
  const [promptDesc, setPromptDesc] = useState('');
  const [promptContent, setPromptContent] = useState('');

  const [submitting, setSubmitting] = useState(false);

  const loadAll = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const [subsRes, passRes, promptsRes] = await Promise.allSettled([
        api.getSubscriptions(),
        api.getPasswords(),
        api.getPrompts(),
      ]);

      if (subsRes.status === 'fulfilled') setSubscriptions(Array.isArray(subsRes.value) ? subsRes.value : []);
      if (passRes.status === 'fulfilled') setPasswords(Array.isArray(passRes.value) ? passRes.value : []);
      if (promptsRes.status === 'fulfilled') setPrompts(Array.isArray(promptsRes.value) ? promptsRes.value : []);
    } catch (e: any) {
      console.warn('Failed to load vault data:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      loadAll();
    }
  }, [isAuthenticated, loadAll]);

  // Handle Android hardware back button
  useEffect(() => {
    const onBackPress = () => {
      if (subModal) {
        setSubModal(false);
        return true;
      }
      if (passModal) {
        setPassModal(false);
        return true;
      }
      if (promptModal) {
        setPromptModal(false);
        return true;
      }
      return false;
    };

    const backSub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backSub.remove();
  }, [subModal, passModal, promptModal]);

  const onRefresh = () => {
    setRefreshing(true);
    loadAll();
  };

  // --- Subscriptions Actions ---
  const handleCreateSub = async () => {
    if (!subName.trim() || !subAmount) {
      Alert.alert('Validation Error', 'Name and amount are required.');
      return;
    }
    const amountNum = parseFloat(subAmount);
    if (isNaN(amountNum)) {
      Alert.alert('Validation Error', 'Please enter a valid numeric amount.');
      return;
    }

    setSubmitting(true);
    try {
      await api.createSubscription({
        name: subName.trim(),
        amount: amountNum,
        purchaseDate: new Date().toISOString().split('T')[0],
        renewalDate: subRenewalDate.trim(),
      });
      setSubModal(false);
      setSubName('');
      setSubAmount('');
      loadAll();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSub = (sub: Subscription) => {
    Alert.alert('Delete Subscription', `Delete "${sub.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteSubscription(sub.id);
            setSubscriptions((prev) => prev.filter((s) => s.id !== sub.id));
          } catch (e: any) {
            Alert.alert('Failed', e.message);
          }
        },
      },
    ]);
  };

  // --- Passwords Actions ---
  const handleCreatePass = async () => {
    if (!passProjectName.trim() || !passIdentifier.trim() || !passSecret) {
      Alert.alert('Validation Error', 'Project name, ID/email, and password are required.');
      return;
    }

    setSubmitting(true);
    try {
      await api.createPassword({
        projectName: passProjectName.trim(),
        url: passUrl.trim(),
        identifier: passIdentifier.trim(),
        password: passSecret,
      });
      setPassModal(false);
      setPassProjectName('');
      setPassUrl('');
      setPassIdentifier('');
      setPassSecret('');
      loadAll();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePass = (item: PasswordItem) => {
    Alert.alert('Delete Credential', `Delete credentials for "${item.projectName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deletePassword(item.id);
            setPasswords((prev) => prev.filter((p) => p.id !== item.id));
          } catch (e: any) {
            Alert.alert('Failed', e.message);
          }
        },
      },
    ]);
  };

  // --- Prompts Actions ---
  const handleCreatePrompt = async () => {
    if (!promptHeading.trim() || !promptContent.trim()) {
      Alert.alert('Validation Error', 'Heading and prompt text are required.');
      return;
    }

    setSubmitting(true);
    try {
      await api.createPrompt({
        heading: promptHeading.trim(),
        description: promptDesc.trim(),
        prompt: promptContent.trim(),
      });
      setPromptModal(false);
      setPromptHeading('');
      setPromptDesc('');
      setPromptContent('');
      loadAll();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePrompt = (item: SavedPrompt) => {
    Alert.alert('Delete Prompt', `Delete prompt "${item.heading}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deletePrompt(item.id);
            setPrompts((prev) => prev.filter((p) => p.id !== item.id));
          } catch (e: any) {
            Alert.alert('Failed', e.message);
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

  const totalMonthlySpend = subscriptions.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Workspace Vault</Text>
          <Text style={styles.headerSubtitle}>Subscriptions, Credentials & Prompts</Text>
        </View>

        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => {
            if (activeTab === 'subs') setSubModal(true);
            else if (activeTab === 'pass') setPassModal(true);
            else setPromptModal(true);
          }}
        >
          <Ionicons name="add" size={20} color="#ffffff" />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {/* Segmented Switcher */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'subs' && styles.tabItemActive]}
          onPress={() => setActiveTab('subs')}
        >
          <Ionicons
            name="card-outline"
            size={16}
            color={activeTab === 'subs' ? '#38bdf8' : '#94a3b8'}
          />
          <Text style={[styles.tabItemText, activeTab === 'subs' && styles.tabItemTextActive]}>
            Subscriptions ({subscriptions.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'pass' && styles.tabItemActive]}
          onPress={() => setActiveTab('pass')}
        >
          <Ionicons
            name="key-outline"
            size={16}
            color={activeTab === 'pass' ? '#38bdf8' : '#94a3b8'}
          />
          <Text style={[styles.tabItemText, activeTab === 'pass' && styles.tabItemTextActive]}>
            Passwords ({passwords.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'prompts' && styles.tabItemActive]}
          onPress={() => setActiveTab('prompts')}
        >
          <Ionicons
            name="bulb-outline"
            size={16}
            color={activeTab === 'prompts' ? '#38bdf8' : '#94a3b8'}
          />
          <Text style={[styles.tabItemText, activeTab === 'prompts' && styles.tabItemTextActive]}>
            Prompts ({prompts.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* TAB 1: SUBSCRIPTIONS */}
      {activeTab === 'subs' && (
        <View style={{ flex: 1 }}>
          <View style={styles.spendBanner}>
            <View>
              <Text style={styles.spendLabel}>Total Monthly Recurring</Text>
              <Text style={styles.spendAmount}>PKR {totalMonthlySpend.toLocaleString()}</Text>
            </View>
            <View style={styles.spendIconBadge}>
              <Ionicons name="trending-up" size={22} color="#38bdf8" />
            </View>
          </View>

          <FlatList
            data={subscriptions}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />}
            ListEmptyComponent={
              loading ? (
                <ActivityIndicator size="small" color="#2563eb" style={{ marginTop: 30 }} />
              ) : (
                <View style={styles.emptyWrap}>
                  <Ionicons name="card-outline" size={44} color="#475569" />
                  <Text style={styles.emptyTitle}>No Subscriptions Tracked</Text>
                  <Text style={styles.emptySub}>Tap '+ Add' to record monthly software spend.</Text>
                </View>
              )
            }
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.cardRow}>
                  <View style={styles.cardLeft}>
                    <Text style={styles.cardName}>{item.name}</Text>
                    <Text style={styles.cardSub}>Renewal: {item.renewalDate}</Text>
                  </View>
                  <View style={styles.cardRight}>
                    <Text style={styles.amountPill}>PKR {Number(item.amount).toLocaleString()}/mo</Text>
                    <TouchableOpacity
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      onPress={() => handleDeleteSub(item)}
                    >
                      <Ionicons name="trash-outline" size={16} color="#94a3b8" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          />
        </View>
      )}

      {/* TAB 2: PASSWORDS */}
      {activeTab === 'pass' && (
        <FlatList
          data={passwords}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator size="small" color="#2563eb" style={{ marginTop: 30 }} />
            ) : (
              <View style={styles.emptyWrap}>
                <Ionicons name="shield-checkmark-outline" size={44} color="#475569" />
                <Text style={styles.emptyTitle}>No Credentials Saved</Text>
                <Text style={styles.emptySub}>Save credentials for your projects safely.</Text>
              </View>
            )
          }
          renderItem={({ item }) => {
            const isVisible = Boolean(visiblePasswords[item.id]);
            return (
              <View style={styles.card}>
                <View style={styles.cardRow}>
                  <Text style={styles.cardName}>{item.projectName}</Text>
                  <TouchableOpacity
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    onPress={() => handleDeletePass(item)}
                  >
                    <Ionicons name="trash-outline" size={16} color="#94a3b8" />
                  </TouchableOpacity>
                </View>

                {item.url ? (
                  <Text style={styles.urlText} numberOfLines={1}>
                    {item.url}
                  </Text>
                ) : null}

                <View style={styles.credRow}>
                  <Ionicons name="person-circle-outline" size={16} color="#94a3b8" />
                  <Text style={styles.credIdentifier}>{item.identifier}</Text>
                </View>

                <View style={styles.passwordRow}>
                  <Ionicons name="key-outline" size={16} color="#94a3b8" />
                  <Text style={styles.credPassword} selectable={true}>
                    {isVisible ? item.password : '••••••••••••'}
                  </Text>
                  <TouchableOpacity
                    onPress={() =>
                      setVisiblePasswords((prev) => ({ ...prev, [item.id]: !isVisible }))
                    }
                    style={styles.eyeBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name={isVisible ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color="#38bdf8"
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleCopyText(`pwd-${item.id}`, item.password)}
                    style={styles.eyeBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name={copiedId === `pwd-${item.id}` ? 'checkmark' : 'copy-outline'}
                      size={17}
                      color={copiedId === `pwd-${item.id}` ? '#4ade80' : '#94a3b8'}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* TAB 3: PROMPTS */}
      {activeTab === 'prompts' && (
        <FlatList
          data={prompts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator size="small" color="#2563eb" style={{ marginTop: 30 }} />
            ) : (
              <View style={styles.emptyWrap}>
                <Ionicons name="sparkles-outline" size={44} color="#475569" />
                <Text style={styles.emptyTitle}>No AI Prompts Saved</Text>
                <Text style={styles.emptySub}>Store system prompts and instructions for your projects.</Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardRow}>
                <Text style={styles.cardName} selectable={true}>{item.heading}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <TouchableOpacity
                    style={styles.copyPromptBtn}
                    onPress={() => handleCopyText(`prompt-${item.id}`, item.prompt)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={copiedId === `prompt-${item.id}` ? 'checkmark' : 'copy-outline'}
                      size={13}
                      color={copiedId === `prompt-${item.id}` ? '#4ade80' : '#38bdf8'}
                    />
                    <Text
                      style={[
                        styles.copyPromptText,
                        copiedId === `prompt-${item.id}` && { color: '#4ade80' },
                      ]}
                    >
                      {copiedId === `prompt-${item.id}` ? 'Copied' : 'Copy'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    onPress={() => handleDeletePrompt(item)}
                  >
                    <Ionicons name="trash-outline" size={16} color="#94a3b8" />
                  </TouchableOpacity>
                </View>
              </View>

              {item.description ? (
                <Text style={styles.promptDesc} selectable={true}>{item.description}</Text>
              ) : null}

              <View style={styles.promptBox}>
                <Text style={styles.promptContentText} numberOfLines={6} selectable={true}>
                  {item.prompt}
                </Text>
              </View>
            </View>
          )}
        />
      )}

      {/* Add Subscription Modal */}
      <Modal
        visible={subModal}
        animationType="slide"
        transparent
        onRequestClose={() => setSubModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Subscription</Text>
              <TouchableOpacity onPress={() => setSubModal(false)}>
                <Ionicons name="close" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>
            <View style={{ gap: 12 }}>
              <TextInput
                style={styles.modalInput}
                placeholder="Service Name (e.g. Supabase Pro)"
                placeholderTextColor="#64748b"
                value={subName}
                onChangeText={setSubName}
              />
              <TextInput
                style={styles.modalInput}
                placeholder="Monthly Amount in PKR (e.g. 5000)"
                placeholderTextColor="#64748b"
                value={subAmount}
                onChangeText={setSubAmount}
                keyboardType="numeric"
              />
              <TextInput
                style={styles.modalInput}
                placeholder="Renewal Date (YYYY-MM-DD)"
                placeholderTextColor="#64748b"
                value={subRenewalDate}
                onChangeText={setSubRenewalDate}
              />
              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleCreateSub}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.modalSubmitText}>Save Subscription</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Password Modal */}
      <Modal
        visible={passModal}
        animationType="slide"
        transparent
        onRequestClose={() => setPassModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Save Credentials</Text>
              <TouchableOpacity onPress={() => setPassModal(false)}>
                <Ionicons name="close" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>
            <View style={{ gap: 12 }}>
              <TextInput
                style={styles.modalInput}
                placeholder="Project / Service Name *"
                placeholderTextColor="#64748b"
                value={passProjectName}
                onChangeText={setPassProjectName}
              />
              <TextInput
                style={styles.modalInput}
                placeholder="Website URL (optional)"
                placeholderTextColor="#64748b"
                value={passUrl}
                onChangeText={setPassUrl}
                autoCapitalize="none"
              />
              <TextInput
                style={styles.modalInput}
                placeholder="Username / Identifier / Email *"
                placeholderTextColor="#64748b"
                value={passIdentifier}
                onChangeText={setPassIdentifier}
                autoCapitalize="none"
              />
              <TextInput
                style={styles.modalInput}
                placeholder="Password *"
                placeholderTextColor="#64748b"
                value={passSecret}
                onChangeText={setPassSecret}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleCreatePass}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.modalSubmitText}>Save Credential</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Prompt Modal */}
      <Modal
        visible={promptModal}
        animationType="slide"
        transparent
        onRequestClose={() => setPromptModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Save AI Prompt</Text>
              <TouchableOpacity onPress={() => setPromptModal(false)}>
                <Ionicons name="close" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>
            <View style={{ gap: 12 }}>
              <TextInput
                style={styles.modalInput}
                placeholder="Prompt Heading *"
                placeholderTextColor="#64748b"
                value={promptHeading}
                onChangeText={setPromptHeading}
              />
              <TextInput
                style={styles.modalInput}
                placeholder="Description / Context (optional)"
                placeholderTextColor="#64748b"
                value={promptDesc}
                onChangeText={setPromptDesc}
              />
              <TextInput
                style={[styles.modalInput, { height: 90, paddingTop: 10 }]}
                placeholder="Full prompt text..."
                placeholderTextColor="#64748b"
                value={promptContent}
                onChangeText={setPromptContent}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleCreatePrompt}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.modalSubmitText}>Save Prompt</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    marginHorizontal: 20,
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 8,
  },
  tabItemActive: {
    backgroundColor: '#334155',
  },
  tabItemText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  tabItemTextActive: {
    color: '#f8fafc',
  },
  spendBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  spendLabel: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  spendAmount: {
    fontSize: 24,
    fontWeight: '800',
    color: '#38bdf8',
    marginTop: 4,
  },
  spendIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#082f49',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 90,
    gap: 10,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 8,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardLeft: {
    flex: 1,
    marginRight: 10,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc',
  },
  cardSub: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  cardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  amountPill: {
    fontSize: 13,
    fontWeight: '700',
    color: '#10b981',
    backgroundColor: '#064e3b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  urlText: {
    fontSize: 12,
    color: '#38bdf8',
  },
  credRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  credIdentifier: {
    fontSize: 13,
    color: '#cbd5e1',
    fontWeight: '500',
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  credPassword: {
    fontSize: 13,
    color: '#f8fafc',
    flex: 1,
    fontFamily: 'monospace',
  },
  eyeBtn: {
    padding: 4,
  },
  promptDesc: {
    fontSize: 12,
    color: '#94a3b8',
  },
  copyPromptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0f172a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  copyPromptText: {
    fontSize: 11,
    color: '#38bdf8',
    fontWeight: '600',
  },
  promptBox: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  promptContentText: {
    fontSize: 12,
    color: '#cbd5e1',
    lineHeight: 18,
    fontFamily: 'monospace',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#cbd5e1',
  },
  emptySub: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#1e293b',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
  },
  modalInput: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12,
    height: 44,
    color: '#f8fafc',
    fontSize: 14,
  },
  modalSubmitBtn: {
    backgroundColor: '#2563eb',
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
  },
  modalSubmitText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});

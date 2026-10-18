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
  Platform,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { AuthScreen } from '@/components/AuthScreen';
import { api } from '@/services/api';
import type { Project, Section } from '@/services/types';

export default function ProjectsScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, user, logout, refreshUser } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newSectionHeading, setNewSectionHeading] = useState('Overview');
  const [newSectionContent, setNewSectionContent] = useState('');
  const [creating, setCreating] = useState(false);

  // Project Detail / View Modal
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [addSectionVisible, setAddSectionVisible] = useState(false);
  const [secHeading, setSecHeading] = useState('');
  const [secContent, setSecContent] = useState('');

  // Copy Feedback States
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedSectionId, setCopiedSectionId] = useState<number | null>(null);

  const handleCopyAllDocs = async () => {
    if (!selectedProject) return;
    let text = `${selectedProject.name}\n`;
    (selectedProject.sections || []).forEach((sec) => {
      text += `-------------------------------------------------------------- ${sec.heading}\n`;
      text += `${sec.content}\n`;
    });
    text += `--------------------------------------------------------------\n`;
    await Clipboard.setStringAsync(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleCopySection = async (sec: Section) => {
    const textToCopy = `${sec.heading}\n\n${sec.content}`;
    await Clipboard.setStringAsync(textToCopy);
    setCopiedSectionId(sec.id);
    setTimeout(() => setCopiedSectionId(null), 2000);
  };

  const loadProjects = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const [data, notifRes] = await Promise.all([
        api.getProjects(),
        api.getNotifications().catch(() => ({ notifications: [], unreadCount: 0 })),
      ]);
      setProjects(Array.isArray(data) ? data : []);
      setUnreadNotifs(notifRes.unreadCount || 0);
    } catch (err: any) {
      console.error('Error loading projects:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      loadProjects();
    }
  }, [isAuthenticated, loadProjects]);

  // Handle Android hardware back button
  useEffect(() => {
    const onBackPress = () => {
      if (addSectionVisible) {
        setAddSectionVisible(false);
        return true;
      }
      if (selectedProject) {
        setSelectedProject(null);
        return true;
      }
      if (createModalVisible) {
        setCreateModalVisible(false);
        return true;
      }
      return false;
    };

    const backSub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backSub.remove();
  }, [addSectionVisible, selectedProject, createModalVisible]);

  const onRefresh = () => {
    setRefreshing(true);
    loadProjects();
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      Alert.alert('Validation Error', 'Please enter a project name.');
      return;
    }

    setCreating(true);
    try {
      const sections: Section[] = [
        {
          id: 1,
          heading: newSectionHeading.trim() || 'Overview',
          content: newSectionContent.trim() || 'Created from mobile app.',
        },
      ];
      await api.createProject(newProjectName.trim(), sections);
      setCreateModalVisible(false);
      setNewProjectName('');
      setNewSectionHeading('Overview');
      setNewSectionContent('');
      loadProjects();
      Alert.alert('Success', 'Project created successfully!');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create project.');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteProject = (project: Project) => {
    Alert.alert(
      'Delete Project',
      `Are you sure you want to delete "${project.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteProject(project.id);
              if (selectedProject?.id === project.id) {
                setSelectedProject(null);
              }
              loadProjects();
            } catch (err: any) {
              Alert.alert('Delete Failed', err.message);
            }
          },
        },
      ]
    );
  };

  const handleAddSection = async () => {
    if (!selectedProject || !secHeading.trim()) {
      Alert.alert('Validation', 'Section heading is required.');
      return;
    }

    const currentSections = selectedProject.sections || [];
    const newSec: Section = {
      id: Date.now(),
      heading: secHeading.trim(),
      content: secContent.trim() || 'No description provided.',
    };

    const updatedProject: Project = {
      ...selectedProject,
      sections: [...currentSections, newSec],
    };

    try {
      await api.createProject(updatedProject.name, updatedProject.sections);
      setSelectedProject(updatedProject);
      setAddSectionVisible(false);
      setSecHeading('');
      setSecContent('');
      loadProjects();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add section.');
    }
  };

  // If auth is still checking
  if (authLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Connecting to workspace...</Text>
      </View>
    );
  }

  // If not logged in, show AuthScreen
  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.username}>{user?.fullName || user?.username || 'User'}</Text>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push('/notifications')}
          >
            <Ionicons name="notifications-outline" size={20} color="#94a3b8" />
            {unreadNotifs > 0 ? (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>
                  {unreadNotifs > 99 ? '99+' : unreadNotifs}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={onRefresh}>
            <Ionicons name="sync-outline" size={20} color="#94a3b8" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconButton, styles.newProjectButton]}
            onPress={() => setCreateModalVisible(true)}
          >
            <Ionicons name="add" size={22} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats Counter Strip */}
      <View style={styles.statsStrip}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{projects.length}</Text>
          <Text style={styles.statLabel}>Projects</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={[styles.statNumber, { color: '#38bdf8' }]}>PostgreSQL</Text>
          <Text style={styles.statLabel}>Database</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={[styles.statNumber, { color: '#4ade80' }]}>Online</Text>
          <Text style={styles.statLabel}>Backend</Text>
        </View>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={18} color="#64748b" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search projects..."
          placeholderTextColor="#64748b"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color="#64748b" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Projects List */}
      <FlatList
        data={filteredProjects}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="small" color="#2563eb" style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="folder-open-outline" size={48} color="#475569" />
              <Text style={styles.emptyTitle}>No Projects Found</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery ? 'Try a different search keyword' : 'Create your first project to get started.'}
              </Text>
              {!searchQuery && (
                <TouchableOpacity
                  style={styles.emptyCreateBtn}
                  onPress={() => setCreateModalVisible(true)}
                >
                  <Text style={styles.emptyCreateBtnText}>Create New Project</Text>
                </TouchableOpacity>
              )}
            </View>
          )
        }
        renderItem={({ item }) => {
          const sectionsCount = item.sections?.length || 0;
          return (
            <TouchableOpacity
              style={styles.projectCard}
              activeOpacity={0.7}
              onPress={() => setSelectedProject(item)}
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleWrap}>
                  <View style={styles.folderIconBadge}>
                    <Ionicons name="folder" size={18} color="#3b82f6" />
                  </View>
                  <Text style={styles.projectName} numberOfLines={1}>
                    {item.name}
                  </Text>
                </View>
                <TouchableOpacity
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  onPress={() => handleDeleteProject(item)}
                >
                  <Ionicons name="trash-outline" size={18} color="#94a3b8" />
                </TouchableOpacity>
              </View>

              <Text style={styles.projectSnippet} numberOfLines={2}>
                {item.sections?.[0]?.content || 'Tap to view documentation sections and details.'}
              </Text>

              <View style={styles.cardFooter}>
                <View style={styles.badge}>
                  <Ionicons name="document-text-outline" size={12} color="#94a3b8" />
                  <Text style={styles.badgeText}>{sectionsCount} {sectionsCount === 1 ? 'section' : 'sections'}</Text>
                </View>

                <View style={styles.chevronWrap}>
                  <Text style={styles.viewDocText}>View Docs</Text>
                  <Ionicons name="chevron-forward" size={14} color="#3b82f6" />
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* Create Project Modal */}
      <Modal
        visible={createModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Project</Text>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                <Ionicons name="close" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ gap: 14 }}>
              <View>
                <Text style={styles.fieldLabel}>Project Name *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. Mobile Redesign"
                  placeholderTextColor="#64748b"
                  value={newProjectName}
                  onChangeText={setNewProjectName}
                />
              </View>

              <View>
                <Text style={styles.fieldLabel}>Initial Section Title</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Overview / Architecture"
                  placeholderTextColor="#64748b"
                  value={newSectionHeading}
                  onChangeText={setNewSectionHeading}
                />
              </View>

              <View>
                <Text style={styles.fieldLabel}>Section Content / Notes</Text>
                <TextInput
                  style={[styles.modalInput, styles.modalTextArea]}
                  placeholder="Write initial project notes, requirements, or documentation..."
                  placeholderTextColor="#64748b"
                  value={newSectionContent}
                  onChangeText={setNewSectionContent}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              <TouchableOpacity
                style={[styles.createSubmitBtn, creating && { opacity: 0.7 }]}
                onPress={handleCreateProject}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.createSubmitBtnText}>Create Project</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Project Details Modal */}
      <Modal
        visible={Boolean(selectedProject)}
        animationType="slide"
        onRequestClose={() => {
          if (addSectionVisible) {
            setAddSectionVisible(false);
          } else {
            setSelectedProject(null);
          }
        }}
      >
        <SafeAreaView style={styles.detailContainer}>
          <View style={styles.detailHeader}>
            <TouchableOpacity onPress={() => setSelectedProject(null)} style={styles.detailBackBtn}>
              <Ionicons name="arrow-back" size={24} color="#f8fafc" />
            </TouchableOpacity>
            <Text style={styles.detailTitle} numberOfLines={1}>
              {selectedProject?.name}
            </Text>
            <TouchableOpacity
              style={styles.addSecBtn}
              onPress={() => setAddSectionVisible(true)}
            >
              <Ionicons name="add-circle-outline" size={22} color="#38bdf8" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.detailBody}>
            <View style={styles.detailInfoBanner}>
              <View style={styles.infoRow}>
                <Ionicons name="calendar-outline" size={14} color="#94a3b8" />
                <Text style={styles.infoText}>
                  ID: {selectedProject?.id}
                </Text>
              </View>
            </View>

            <View style={styles.sectionsHeaderRow}>
              <Text style={styles.sectionsHeader}>Documentation Sections</Text>
              {selectedProject?.sections && selectedProject.sections.length > 0 ? (
                <TouchableOpacity
                  style={[styles.copyAllBtn, copiedAll && styles.copyAllBtnCopied]}
                  onPress={handleCopyAllDocs}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={copiedAll ? 'checkmark-circle' : 'copy-outline'}
                    size={14}
                    color={copiedAll ? '#4ade80' : '#38bdf8'}
                  />
                  <Text style={[styles.copyAllText, copiedAll && { color: '#4ade80' }]}>
                    {copiedAll ? 'Copied All!' : 'Copy All Docs'}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {selectedProject?.sections && selectedProject.sections.length > 0 ? (
              selectedProject.sections.map((sec, idx) => (
                <View key={sec.id || idx} style={styles.sectionCard}>
                  <View style={styles.sectionHeadRow}>
                    <Text style={styles.sectionHeading} selectable={true}>
                      {sec.heading}
                    </Text>
                    <View style={styles.secActionsRow}>
                      <TouchableOpacity
                        style={styles.secCopyBtn}
                        onPress={() => handleCopySection(sec)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={copiedSectionId === sec.id ? 'checkmark' : 'copy-outline'}
                          size={14}
                          color={copiedSectionId === sec.id ? '#4ade80' : '#94a3b8'}
                        />
                        <Text
                          style={[
                            styles.secCopyText,
                            copiedSectionId === sec.id && { color: '#4ade80' },
                          ]}
                        >
                          {copiedSectionId === sec.id ? 'Copied' : 'Copy'}
                        </Text>
                      </TouchableOpacity>
                      <View style={styles.secIndexBadge}>
                        <Text style={styles.secIndexText}>#{idx + 1}</Text>
                      </View>
                    </View>
                  </View>
                  <Text style={styles.sectionContent} selectable={true}>
                    {sec.content}
                  </Text>
                </View>
              ))
            ) : (
              <View style={styles.emptySecContainer}>
                <Text style={styles.emptySecText}>No sections yet.</Text>
                <TouchableOpacity
                  style={styles.addFirstSecBtn}
                  onPress={() => setAddSectionVisible(true)}
                >
                  <Text style={styles.addFirstSecBtnText}>Add Section</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>

          {/* Add Section Sub-Modal */}
          <Modal
            visible={addSectionVisible}
            animationType="fade"
            transparent
            onRequestClose={() => setAddSectionVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Add Documentation Section</Text>
                  <TouchableOpacity onPress={() => setAddSectionVisible(false)}>
                    <Ionicons name="close" size={24} color="#94a3b8" />
                  </TouchableOpacity>
                </View>

                <View style={{ gap: 14 }}>
                  <View>
                    <Text style={styles.fieldLabel}>Heading</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="e.g. Deployment Steps"
                      placeholderTextColor="#64748b"
                      value={secHeading}
                      onChangeText={setSecHeading}
                    />
                  </View>

                  <View>
                    <Text style={styles.fieldLabel}>Content</Text>
                    <TextInput
                      style={[styles.modalInput, styles.modalTextArea]}
                      placeholder="Enter section documentation..."
                      placeholderTextColor="#64748b"
                      value={secContent}
                      onChangeText={setSecContent}
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                    />
                  </View>

                  <TouchableOpacity style={styles.createSubmitBtn} onPress={handleAddSection}>
                    <Text style={styles.createSubmitBtnText}>Save Section</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </SafeAreaView>
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
    gap: 12,
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 14,
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
  greeting: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '500',
  },
  username: {
    fontSize: 22,
    fontWeight: '800',
    color: '#f8fafc',
    letterSpacing: -0.3,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    paddingHorizontal: 4,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  newProjectButton: {
    backgroundColor: '#2563eb',
    borderColor: '#3b82f6',
  },
  statsStrip: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#1e293b',
    borderRadius: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: '#f8fafc',
  },
  statLabel: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    height: '60%',
    backgroundColor: '#334155',
    alignSelf: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: '#334155',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 90,
    gap: 12,
  },
  projectCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 10,
  },
  folderIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#1e3a8a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  projectName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#f8fafc',
    flex: 1,
  },
  projectSnippet: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  chevronWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewDocText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3b82f6',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#cbd5e1',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
  },
  emptyCreateBtn: {
    marginTop: 10,
    backgroundColor: '#2563eb',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  emptyCreateBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
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
    maxHeight: '90%',
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
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#cbd5e1',
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 14,
    height: 44,
    color: '#f8fafc',
    fontSize: 14,
  },
  modalTextArea: {
    height: 90,
    paddingTop: 10,
  },
  createSubmitBtn: {
    backgroundColor: '#2563eb',
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
  },
  createSubmitBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  detailContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  detailBackBtn: {
    padding: 6,
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f8fafc',
    flex: 1,
    marginHorizontal: 10,
    textAlign: 'center',
  },
  addSecBtn: {
    padding: 6,
  },
  detailBody: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },
  detailInfoBanner: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  sectionsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  sectionsHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc',
  },
  copyAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#38bdf8',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  copyAllBtnCopied: {
    borderColor: '#4ade80',
    backgroundColor: '#064e3b',
  },
  copyAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#38bdf8',
  },
  secActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  secCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0f172a',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  secCopyText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  sectionCard: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 8,
  },
  sectionHeadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#38bdf8',
    flex: 1,
  },
  secIndexBadge: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  secIndexText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '700',
  },
  sectionContent: {
    fontSize: 14,
    color: '#cbd5e1',
    lineHeight: 22,
  },
  emptySecContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptySecText: {
    color: '#64748b',
    fontSize: 14,
  },
  addFirstSecBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addFirstSecBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
});

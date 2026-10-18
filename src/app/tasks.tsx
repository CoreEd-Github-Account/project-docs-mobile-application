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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { AuthScreen } from '@/components/AuthScreen';
import { api } from '@/services/api';
import type { Project, TaskItem, TaskStage, TaskComment, TaskSubComment } from '@/services/types';

export function formatFullDateTime(timestamp: number): string {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function parseComments(rawComments?: string | null, fallbackTimestamp?: number): TaskComment[] {
  if (!rawComments || !rawComments.trim()) return [];
  const trimmed = rawComments.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((c) => c && typeof c === 'object' && (c.text || c.content))
          .map((c, i) => {
            const createdAt = Number(c.createdAt || c.created_at) || fallbackTimestamp || Date.now();
            const dateTime = String(c.dateTime || c.date_time || c.date || '').trim() || formatFullDateTime(createdAt);
            const completed = Boolean(c.completed || c.isCompleted || c.done);

            const rawSubs = Array.isArray(c.subComments)
              ? c.subComments
              : Array.isArray(c.sub_comments)
              ? c.sub_comments
              : Array.isArray(c.replies)
              ? c.replies
              : [];

            const subComments: TaskSubComment[] = rawSubs
              .filter((s: any) => s && typeof s === 'object' && (s.text || s.content))
              .map((s: any, subIdx: number) => {
                const subCreatedAt = Number(s.createdAt || s.created_at) || createdAt || Date.now();
                const subDateTime = String(s.dateTime || s.date_time || s.date || '').trim() || formatFullDateTime(subCreatedAt);
                const subCompleted = Boolean(s.completed || s.isCompleted || s.done);
                return {
                  id: String(s.id || `sub-${i}-${subIdx}-${subCreatedAt}`),
                  text: String(s.text || s.content || '').trim(),
                  createdAt: subCreatedAt,
                  dateTime: subDateTime,
                  completed: subCompleted,
                };
              });

            return {
              id: String(c.id || `c-${i}-${createdAt}`),
              text: String(c.text || c.content || '').trim(),
              createdAt,
              dateTime,
              completed,
              subComments,
            };
          });
      }
    } catch {
      // Fall through to plain text
    }
  }

  const ts = fallbackTimestamp || Date.now();
  return [
    {
      id: 'comment-initial',
      text: trimmed,
      createdAt: ts,
      dateTime: formatFullDateTime(ts),
      completed: false,
      subComments: [],
    },
  ];
}

export default function TasksScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStage, setSelectedStage] = useState<string>('all');

  // New Task Modal state
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskStage, setTaskStage] = useState<TaskStage>('inprogress');
  const [savingTask, setSavingTask] = useState(false);

  // Task Details & Comments Modal state
  const [activeDetailTask, setActiveDetailTask] = useState<TaskItem | null>(null);
  const [newCommentText, setNewCommentText] = useState('');
  const [replyingCommentId, setReplyingCommentId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [savingComment, setSavingComment] = useState(false);

  // Load Projects first
  const loadProjects = useCallback(async () => {
    try {
      const [data, notifRes] = await Promise.all([
        api.getProjects(),
        api.getNotifications().catch(() => ({ notifications: [], unreadCount: 0 })),
      ]);
      const list = Array.isArray(data) ? data : [];
      setProjects(list);
      setUnreadCount(notifRes.unreadCount || 0);
      if (list.length > 0 && !selectedProjectId) {
        setSelectedProjectId(list[0].id);
      }
    } catch (e: any) {
      console.error('Failed to load projects for tasks:', e.message);
    }
  }, [selectedProjectId]);

  // Load Tasks for selected project
  const loadTasks = useCallback(async (projId: string) => {
    if (!projId) {
      setTasks([]);
      return;
    }
    setLoading(true);
    try {
      const data = await api.getTasks(projId);
      const list = Array.isArray(data) ? data : [];
      setTasks(list);
      // Keep activeDetailTask synchronized if it's currently open
      setActiveDetailTask((current) => {
        if (!current) return null;
        const found = list.find((t) => t.id === current.id);
        return found || current;
      });
    } catch (e: any) {
      console.error('Failed to load tasks:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadProjects();
    }
  }, [isAuthenticated, loadProjects]);

  useEffect(() => {
    if (selectedProjectId) {
      loadTasks(selectedProjectId);
    }
  }, [selectedProjectId, loadTasks]);

  // Handle Android hardware back button
  useEffect(() => {
    const onBackPress = () => {
      if (createModalVisible) {
        setCreateModalVisible(false);
        return true;
      }
      if (activeDetailTask) {
        setActiveDetailTask(null);
        setReplyingCommentId(null);
        setReplyText('');
        return true;
      }
      return false;
    };

    const backSub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backSub.remove();
  }, [createModalVisible, activeDetailTask]);

  const onRefresh = () => {
    setRefreshing(true);
    loadProjects();
    if (selectedProjectId) {
      loadTasks(selectedProjectId);
    } else {
      setRefreshing(false);
    }
  };

  // Create Task with explicit id, heading, and projectId
  const handleCreateTask = async () => {
    if (!selectedProjectId) {
      Alert.alert('Error', 'Please select or create a project first.');
      return;
    }
    const headingTrimmed = taskTitle.trim();
    if (!headingTrimmed) {
      Alert.alert('Validation Error', 'Task heading/title is required.');
      return;
    }

    setSavingTask(true);
    try {
      const created = await api.createTask({
        projectId: selectedProjectId,
        heading: headingTrimmed,
        title: headingTrimmed,
        description: taskDescription.trim(),
        stage: taskStage,
        comments: '[]',
      });

      setCreateModalVisible(false);
      setTaskTitle('');
      setTaskDescription('');
      setTaskStage('inprogress');

      // Optimistically prepend or reload
      if (created && created.id) {
        setTasks((prev) => [created, ...prev.filter((t) => t.id !== created.id)]);
      }
      loadTasks(selectedProjectId);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create task.');
    } finally {
      setSavingTask(false);
    }
  };

  // Cycle stage on card tap
  const handleCycleStage = async (task: TaskItem) => {
    const nextStages: Record<TaskStage, TaskStage> = {
      inprogress: 'completed',
      completed: 'stopped',
      stopped: 'inprogress',
    };
    const nextStage = nextStages[task.stage] || 'inprogress';

    const updatedTask: TaskItem = { ...task, stage: nextStage };
    setTasks((prev) => prev.map((t) => (t.id === task.id ? updatedTask : t)));
    if (activeDetailTask && activeDetailTask.id === task.id) {
      setActiveDetailTask(updatedTask);
    }

    try {
      await api.updateTaskStage(task.id, selectedProjectId, nextStage, updatedTask);
    } catch (err: any) {
      // Revert on failure
      setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
      if (activeDetailTask && activeDetailTask.id === task.id) {
        setActiveDetailTask(task);
      }
      Alert.alert('Failed to update stage', err.message || 'Could not update status');
    }
  };

  // Directly set stage from modal
  const handleSetStage = async (task: TaskItem, newStage: TaskStage) => {
    if (task.stage === newStage) return;

    const updatedTask: TaskItem = { ...task, stage: newStage };
    setTasks((prev) => prev.map((t) => (t.id === task.id ? updatedTask : t)));
    setActiveDetailTask(updatedTask);

    try {
      await api.updateTaskStage(task.id, selectedProjectId, newStage, updatedTask);
    } catch (err: any) {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
      setActiveDetailTask(task);
      Alert.alert('Failed to update stage', err.message);
    }
  };

  const handleDeleteTask = (task: TaskItem) => {
    Alert.alert('Delete Task', `Delete "${task.heading || task.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteTask(task.id, selectedProjectId);
            setTasks((prev) => prev.filter((t) => t.id !== task.id));
            if (activeDetailTask && activeDetailTask.id === task.id) {
              setActiveDetailTask(null);
            }
          } catch (err: any) {
            Alert.alert('Failed to delete', err.message);
          }
        },
      },
    ]);
  };

  // --- COMMENTS MANAGEMENT ---
  const handleAddComment = async () => {
    if (!activeDetailTask) return;
    const text = newCommentText.trim();
    if (!text) return;

    const now = Date.now();
    const existingComments = parseComments(activeDetailTask.comments, activeDetailTask.createdAt);
    const newCommentItem: TaskComment = {
      id: `c-${now}-${Math.random().toString(36).substring(2, 6)}`,
      text,
      createdAt: now,
      dateTime: formatFullDateTime(now),
      completed: false,
      subComments: [],
    };

    const updatedComments = [...existingComments, newCommentItem];
    const commentsJson = JSON.stringify(updatedComments);
    const updatedTask: TaskItem = { ...activeDetailTask, comments: commentsJson };

    setActiveDetailTask(updatedTask);
    setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
    setNewCommentText('');
    setSavingComment(true);

    try {
      await api.updateTask(updatedTask);
    } catch (err: any) {
      Alert.alert('Error', 'Failed to save comment: ' + err.message);
    } finally {
      setSavingComment(false);
    }
  };

  const handleToggleComment = async (commentId: string) => {
    if (!activeDetailTask) return;

    const existingComments = parseComments(activeDetailTask.comments, activeDetailTask.createdAt);
    const updatedComments = existingComments.map((c) => {
      if (c.id === commentId) {
        return { ...c, completed: !c.completed };
      }
      return c;
    });

    const commentsJson = JSON.stringify(updatedComments);
    const updatedTask: TaskItem = { ...activeDetailTask, comments: commentsJson };

    setActiveDetailTask(updatedTask);
    setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));

    try {
      await api.updateTask(updatedTask);
    } catch (err: any) {
      console.error('Failed to toggle comment:', err.message);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!activeDetailTask) return;

    Alert.alert('Delete Comment', 'Are you sure you want to delete this comment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const existingComments = parseComments(activeDetailTask.comments, activeDetailTask.createdAt);
          const updatedComments = existingComments.filter((c) => c.id !== commentId);
          const commentsJson = updatedComments.length > 0 ? JSON.stringify(updatedComments) : '[]';
          const updatedTask: TaskItem = { ...activeDetailTask, comments: commentsJson };

          setActiveDetailTask(updatedTask);
          setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));

          try {
            await api.updateTask(updatedTask);
          } catch (err: any) {
            Alert.alert('Error', 'Failed to delete comment: ' + err.message);
          }
        },
      },
    ]);
  };

  // --- SUB-COMMENTS MANAGEMENT ---
  const handleAddSubComment = async (commentId: string) => {
    if (!activeDetailTask) return;
    const text = replyText.trim();
    if (!text) return;

    const now = Date.now();
    const newSubItem: TaskSubComment = {
      id: `sub-${now}-${Math.random().toString(36).substring(2, 6)}`,
      text,
      createdAt: now,
      dateTime: formatFullDateTime(now),
      completed: false,
    };

    const existingComments = parseComments(activeDetailTask.comments, activeDetailTask.createdAt);
    const updatedComments = existingComments.map((c) => {
      if (c.id === commentId) {
        return {
          ...c,
          subComments: [...(c.subComments || []), newSubItem],
        };
      }
      return c;
    });

    const commentsJson = JSON.stringify(updatedComments);
    const updatedTask: TaskItem = { ...activeDetailTask, comments: commentsJson };

    setActiveDetailTask(updatedTask);
    setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
    setReplyingCommentId(null);
    setReplyText('');

    try {
      await api.updateTask(updatedTask);
    } catch (err: any) {
      Alert.alert('Error', 'Failed to save sub-comment: ' + err.message);
    }
  };

  const handleToggleSubComment = async (commentId: string, subCommentId: string) => {
    if (!activeDetailTask) return;

    const existingComments = parseComments(activeDetailTask.comments, activeDetailTask.createdAt);
    const updatedComments = existingComments.map((c) => {
      if (c.id === commentId) {
        const updatedSubs = (c.subComments || []).map((sc) => {
          if (sc.id === subCommentId) {
            return { ...sc, completed: !sc.completed };
          }
          return sc;
        });
        return { ...c, subComments: updatedSubs };
      }
      return c;
    });

    const commentsJson = JSON.stringify(updatedComments);
    const updatedTask: TaskItem = { ...activeDetailTask, comments: commentsJson };

    setActiveDetailTask(updatedTask);
    setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));

    try {
      await api.updateTask(updatedTask);
    } catch (err: any) {
      console.error('Failed to toggle sub-comment:', err.message);
    }
  };

  const handleDeleteSubComment = async (commentId: string, subCommentId: string) => {
    if (!activeDetailTask) return;

    Alert.alert('Delete Sub-comment', 'Delete this reply?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const existingComments = parseComments(activeDetailTask.comments, activeDetailTask.createdAt);
          const updatedComments = existingComments.map((c) => {
            if (c.id === commentId) {
              const updatedSubs = (c.subComments || []).filter((sc) => sc.id !== subCommentId);
              return { ...c, subComments: updatedSubs };
            }
            return c;
          });

          const commentsJson = JSON.stringify(updatedComments);
          const updatedTask: TaskItem = { ...activeDetailTask, comments: commentsJson };

          setActiveDetailTask(updatedTask);
          setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));

          try {
            await api.updateTask(updatedTask);
          } catch (err: any) {
            Alert.alert('Error', 'Failed to delete reply: ' + err.message);
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

  const filteredTasks = tasks.filter((t) => {
    if (selectedStage === 'all') return true;
    return t.stage === selectedStage;
  });

  const getStageBadgeInfo = (stage: TaskStage) => {
    switch (stage) {
      case 'completed':
        return { label: 'Completed', color: '#10b981', bg: '#064e3b', icon: 'checkmark-circle' };
      case 'stopped':
        return { label: 'Stopped', color: '#f87171', bg: '#451a1a', icon: 'pause-circle' };
      case 'inprogress':
      default:
        return { label: 'In Progress', color: '#38bdf8', bg: '#082f49', icon: 'time-outline' };
    }
  };

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  // Active detail task parsed comments
  const activeComments: TaskComment[] = activeDetailTask
    ? parseComments(activeDetailTask.comments, activeDetailTask.createdAt)
    : [];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Task Tracker</Text>
          <Text style={styles.headerSubtitle}>
            {selectedProject ? selectedProject.name : 'Select a Project'}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity
            style={styles.bellBtn}
            onPress={() => router.push('/notifications')}
            activeOpacity={0.8}
          >
            <Ionicons name="notifications-outline" size={20} color="#94a3b8" />
            {unreadCount > 0 ? (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.addTaskBtn}
            onPress={() => setCreateModalVisible(true)}
            disabled={!selectedProjectId}
          >
            <Ionicons name="add" size={20} color="#ffffff" />
            <Text style={styles.addTaskBtnText}>New Task</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Project Selector Horizontal Pills */}
      <View style={styles.projectPillsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.projectPillsList}>
          {projects.map((proj) => {
            const isSelected = proj.id === selectedProjectId;
            return (
              <TouchableOpacity
                key={proj.id}
                style={[styles.projPill, isSelected && styles.projPillActive]}
                onPress={() => setSelectedProjectId(proj.id)}
              >
                <Ionicons
                  name={isSelected ? 'folder' : 'folder-outline'}
                  size={14}
                  color={isSelected ? '#ffffff' : '#94a3b8'}
                />
                <Text style={[styles.projPillText, isSelected && styles.projPillTextActive]} numberOfLines={1}>
                  {proj.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Stage Filter Chips */}
      <View style={styles.stageTabs}>
        {[
          { key: 'all', label: 'All' },
          { key: 'inprogress', label: 'In Progress' },
          { key: 'completed', label: 'Done' },
          { key: 'stopped', label: 'Stopped' },
        ].map((tab) => {
          const isActive = selectedStage === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.stageTab, isActive && styles.stageTabActive]}
              onPress={() => setSelectedStage(tab.key)}
            >
              <Text style={[styles.stageTabText, isActive && styles.stageTabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Tasks List */}
      <FlatList
        data={filteredTasks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.taskListContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="small" color="#2563eb" style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="checkbox-outline" size={48} color="#475569" />
              <Text style={styles.emptyTitle}>No Tasks Found</Text>
              <Text style={styles.emptySubtitle}>
                {selectedProjectId
                  ? 'No tasks under this stage. Tap "New Task" to create one!'
                  : 'Please create or select a project first.'}
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const badge = getStageBadgeInfo(item.stage);
          const taskComments = parseComments(item.comments, item.createdAt);
          const totalCommentsCount = taskComments.reduce(
            (acc, c) => acc + 1 + (c.subComments?.length || 0),
            0
          );

          return (
            <TouchableOpacity
              style={styles.taskCard}
              activeOpacity={0.88}
              onPress={() => setActiveDetailTask(item)}
            >
              <View style={styles.taskCardTop}>
                {/* Stage Badge (tap to toggle stage directly) */}
                <TouchableOpacity
                  style={[styles.stageBadge, { backgroundColor: badge.bg }]}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleCycleStage(item);
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name={badge.icon as any} size={13} color={badge.color} />
                  <Text style={[styles.stageBadgeText, { color: badge.color }]}>{badge.label}</Text>
                  <Ionicons name="swap-horizontal" size={11} color={badge.color} style={{ marginLeft: 2 }} />
                </TouchableOpacity>

                <TouchableOpacity
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleDeleteTask(item);
                  }}
                >
                  <Ionicons name="trash-outline" size={16} color="#94a3b8" />
                </TouchableOpacity>
              </View>

              <Text style={styles.taskTitle}>{item.heading || item.title || 'Untitled Task'}</Text>

              {item.description ? (
                <Text style={styles.taskDescription} numberOfLines={2}>
                  {item.description}
                </Text>
              ) : null}

              <View style={styles.taskCardBottom}>
                <Text style={styles.cycleTip}>Tap badge to toggle stage</Text>

                <TouchableOpacity
                  style={[styles.commentsPill, totalCommentsCount > 0 && styles.commentsPillActive]}
                  onPress={() => setActiveDetailTask(item)}
                >
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={13}
                    color={totalCommentsCount > 0 ? '#38bdf8' : '#94a3b8'}
                  />
                  <Text
                    style={[
                      styles.commentsText,
                      totalCommentsCount > 0 && { color: '#38bdf8', fontWeight: '700' },
                    ]}
                  >
                    {totalCommentsCount > 0
                      ? `${totalCommentsCount} comment${totalCommentsCount > 1 ? 's' : ''}`
                      : 'Add Comment'}
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* --- CREATE NEW TASK MODAL --- */}
      <Modal
        visible={createModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Create New Task</Text>
                <Text style={styles.modalSubtitle}>
                  in {selectedProject ? selectedProject.name : 'Selected Project'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                <Ionicons name="close" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ gap: 14 }}>
              <View>
                <Text style={styles.fieldLabel}>Task Heading / Title *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. Implement authentication screens"
                  placeholderTextColor="#64748b"
                  value={taskTitle}
                  onChangeText={setTaskTitle}
                  autoFocus
                />
              </View>

              <View>
                <Text style={styles.fieldLabel}>Description (Optional)</Text>
                <TextInput
                  style={[styles.modalInput, { height: 80, paddingTop: 10 }]}
                  placeholder="Task details, requirements, acceptance criteria..."
                  placeholderTextColor="#64748b"
                  value={taskDescription}
                  onChangeText={setTaskDescription}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              <View>
                <Text style={styles.fieldLabel}>Initial Stage</Text>
                <View style={styles.stageSelectRow}>
                  {[
                    { key: 'inprogress', label: 'In Progress' },
                    { key: 'completed', label: 'Completed' },
                    { key: 'stopped', label: 'Stopped' },
                  ].map((s) => (
                    <TouchableOpacity
                      key={s.key}
                      style={[
                        styles.stageSelectOption,
                        taskStage === s.key && styles.stageSelectOptionActive,
                      ]}
                      onPress={() => setTaskStage(s.key as TaskStage)}
                    >
                      <Text
                        style={[
                          styles.stageSelectText,
                          taskStage === s.key && styles.stageSelectTextActive,
                        ]}
                      >
                        {s.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                style={[styles.createSubmitBtn, savingTask && { opacity: 0.7 }]}
                onPress={handleCreateTask}
                disabled={savingTask}
              >
                {savingTask ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.createSubmitBtnText}>Create Task</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* --- TASK DETAILS & COMMENTS / SUB-COMMENTS MODAL --- */}
      <Modal
        visible={Boolean(activeDetailTask)}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setActiveDetailTask(null);
          setReplyingCommentId(null);
          setReplyText('');
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { maxHeight: '90%', flex: 1 }]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.modalTitle} numberOfLines={2}>
                  {activeDetailTask?.heading || activeDetailTask?.title || 'Task Details'}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {selectedProject?.name || 'Project Task'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setActiveDetailTask(null);
                  setReplyingCommentId(null);
                  setReplyText('');
                }}
              >
                <Ionicons name="close" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {/* Stage Selector Bar */}
            {activeDetailTask ? (
              <View style={styles.stageSwitcherContainer}>
                <Text style={styles.stageSwitcherLabel}>Status:</Text>
                <View style={styles.stageSwitcherButtons}>
                  {(
                    [
                      { key: 'inprogress', label: 'In Progress', color: '#38bdf8' },
                      { key: 'completed', label: 'Completed', color: '#10b981' },
                      { key: 'stopped', label: 'Stopped', color: '#f87171' },
                    ] as const
                  ).map((s) => {
                    const isActive = activeDetailTask.stage === s.key;
                    return (
                      <TouchableOpacity
                        key={s.key}
                        style={[
                          styles.stageSwitcherBtn,
                          isActive && {
                            backgroundColor: `${s.color}25`,
                            borderColor: s.color,
                          },
                        ]}
                        onPress={() => handleSetStage(activeDetailTask, s.key)}
                      >
                        <Text
                          style={[
                            styles.stageSwitcherBtnText,
                            isActive && { color: s.color, fontWeight: '700' },
                          ]}
                        >
                          {s.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {/* Scrollable Details & Comments Body */}
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 16 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Task Description */}
              {activeDetailTask?.description ? (
                <View style={styles.detailDescCard}>
                  <Text style={styles.detailDescLabel}>Description</Text>
                  <Text style={styles.detailDescText} selectable>
                    {activeDetailTask.description}
                  </Text>
                </View>
              ) : null}

              {/* Comments Section Header */}
              <View style={styles.commentsSectionHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="chatbubbles-outline" size={18} color="#38bdf8" />
                  <Text style={styles.commentsSectionTitle}>Comments & Notes</Text>
                </View>
                <Text style={styles.commentsCountBadge}>
                  {activeComments.reduce(
                    (acc, c) => acc + 1 + (c.subComments?.length || 0),
                    0
                  )}
                </Text>
              </View>

              {/* Comments & Sub-comments list */}
              {activeComments.length === 0 ? (
                <View style={styles.emptyCommentsBox}>
                  <Ionicons name="chatbubble-outline" size={32} color="#475569" />
                  <Text style={styles.emptyCommentsText}>
                    No comments yet. Write a note or update below!
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 10, marginTop: 8 }}>
                  {activeComments.map((comment) => {
                    const isReplying = replyingCommentId === comment.id;
                    const subComments = comment.subComments || [];

                    return (
                      <View key={comment.id} style={styles.commentCard}>
                        {/* Parent Comment Item */}
                        <View style={styles.commentRow}>
                          <TouchableOpacity
                            style={[
                              styles.checkbox,
                              comment.completed && styles.checkboxActive,
                            ]}
                            onPress={() => handleToggleComment(comment.id)}
                          >
                            {comment.completed ? (
                              <Ionicons name="checkmark" size={14} color="#ffffff" />
                            ) : null}
                          </TouchableOpacity>

                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.commentText,
                                comment.completed && styles.commentTextCompleted,
                              ]}
                              selectable
                            >
                              {comment.text}
                            </Text>
                            <View style={styles.commentMetaRow}>
                              <Text style={styles.commentDateText}>
                                {comment.dateTime || formatFullDateTime(comment.createdAt)}
                              </Text>

                              <TouchableOpacity
                                style={styles.replyBtn}
                                onPress={() => {
                                  if (isReplying) {
                                    setReplyingCommentId(null);
                                    setReplyText('');
                                  } else {
                                    setReplyingCommentId(comment.id);
                                    setReplyText('');
                                  }
                                }}
                              >
                                <Ionicons
                                  name={isReplying ? 'close' : 'return-down-forward'}
                                  size={13}
                                  color="#38bdf8"
                                />
                                <Text style={styles.replyBtnText}>
                                  {isReplying ? 'Cancel' : 'Reply'}
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>

                          <TouchableOpacity
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            onPress={() => handleDeleteComment(comment.id)}
                          >
                            <Ionicons name="trash-outline" size={15} color="#94a3b8" />
                          </TouchableOpacity>
                        </View>

                        {/* Sub-comments Thread */}
                        {subComments.length > 0 || isReplying ? (
                          <View style={styles.subCommentsThread}>
                            {subComments.map((sub) => (
                              <View key={sub.id} style={styles.subCommentRow}>
                                <TouchableOpacity
                                  style={[
                                    styles.subCheckbox,
                                    sub.completed && styles.checkboxActive,
                                  ]}
                                  onPress={() => handleToggleSubComment(comment.id, sub.id)}
                                >
                                  {sub.completed ? (
                                    <Ionicons name="checkmark" size={12} color="#ffffff" />
                                  ) : null}
                                </TouchableOpacity>

                                <View style={{ flex: 1 }}>
                                  <Text
                                    style={[
                                      styles.subCommentText,
                                      sub.completed && styles.commentTextCompleted,
                                    ]}
                                    selectable
                                  >
                                    {sub.text}
                                  </Text>
                                  <Text style={styles.subCommentDateText}>
                                    {sub.dateTime || formatFullDateTime(sub.createdAt)}
                                  </Text>
                                </View>

                                <TouchableOpacity
                                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                  onPress={() => handleDeleteSubComment(comment.id, sub.id)}
                                >
                                  <Ionicons name="close" size={14} color="#94a3b8" />
                                </TouchableOpacity>
                              </View>
                            ))}

                            {/* Inline Reply Input */}
                            {isReplying ? (
                              <View style={styles.replyInputBox}>
                                <TextInput
                                  style={styles.replyInput}
                                  placeholder="Write a sub-comment reply..."
                                  placeholderTextColor="#64748b"
                                  value={replyText}
                                  onChangeText={setReplyText}
                                  autoFocus
                                />
                                <TouchableOpacity
                                  style={[
                                    styles.sendReplyBtn,
                                    !replyText.trim() && { opacity: 0.5 },
                                  ]}
                                  disabled={!replyText.trim()}
                                  onPress={() => handleAddSubComment(comment.id)}
                                >
                                  <Ionicons name="send" size={14} color="#ffffff" />
                                </TouchableOpacity>
                              </View>
                            ) : null}
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>

            {/* Bottom Add Comment Input Box */}
            <View style={styles.addCommentFooter}>
              <TextInput
                style={styles.commentInput}
                placeholder="Write a comment..."
                placeholderTextColor="#64748b"
                value={newCommentText}
                onChangeText={setNewCommentText}
              />
              <TouchableOpacity
                style={[
                  styles.sendCommentBtn,
                  (!newCommentText.trim() || savingComment) && { opacity: 0.5 },
                ]}
                disabled={!newCommentText.trim() || savingComment}
                onPress={handleAddComment}
              >
                {savingComment ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="paper-plane" size={15} color="#ffffff" />
                    <Text style={styles.sendCommentBtnText}>Post</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
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
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  bellBtn: {
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
  bellBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
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
  addTaskBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  addTaskBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  projectPillsContainer: {
    paddingVertical: 8,
  },
  projectPillsList: {
    paddingHorizontal: 20,
    gap: 8,
  },
  projPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  projPillActive: {
    backgroundColor: '#2563eb',
    borderColor: '#3b82f6',
  },
  projPillText: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '600',
    maxWidth: 160,
  },
  projPillTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  stageTabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 8,
  },
  stageTab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  stageTabActive: {
    backgroundColor: '#0f274a',
    borderColor: '#2563eb',
  },
  stageTabText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  stageTabTextActive: {
    color: '#38bdf8',
    fontWeight: '700',
  },
  taskListContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
    gap: 12,
  },
  taskCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  taskCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  stageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  stageBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 6,
    lineHeight: 22,
  },
  taskDescription: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 18,
    marginBottom: 12,
  },
  taskCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  cycleTip: {
    fontSize: 11,
    color: '#64748b',
  },
  commentsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#0f172a',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  commentsPillActive: {
    backgroundColor: '#0c2e4e',
    borderColor: '#0284c7',
  },
  commentsText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 30,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#e2e8f0',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#334155',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#ffffff',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 14,
  },
  stageSelectRow: {
    flexDirection: 'row',
    gap: 8,
  },
  stageSelectOption: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  stageSelectOptionActive: {
    backgroundColor: '#2563eb',
    borderColor: '#3b82f6',
  },
  stageSelectText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  stageSelectTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  createSubmitBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  createSubmitBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  stageSwitcherContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1e293b',
    padding: 10,
    borderRadius: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  stageSwitcherLabel: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '700',
  },
  stageSwitcherButtons: {
    flexDirection: 'row',
    flex: 1,
    gap: 6,
  },
  stageSwitcherBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0f172a',
  },
  stageSwitcherBtnText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  detailDescCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  detailDescLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  detailDescText: {
    fontSize: 14,
    color: '#cbd5e1',
    lineHeight: 20,
  },
  commentsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  commentsSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  commentsCountBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#38bdf8',
    backgroundColor: '#0c2e4e',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  emptyCommentsBox: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 6,
  },
  emptyCommentsText: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
  },
  commentCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#475569',
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxActive: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  commentText: {
    fontSize: 14,
    color: '#f1f5f9',
    lineHeight: 20,
  },
  commentTextCompleted: {
    textDecorationLine: 'line-through',
    color: '#64748b',
  },
  commentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
  },
  commentDateText: {
    fontSize: 11,
    color: '#38bdf8',
  },
  replyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  replyBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38bdf8',
  },
  subCommentsThread: {
    marginTop: 10,
    marginLeft: 16,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: '#38bdf8',
    gap: 8,
  },
  subCommentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#0f172a',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  subCheckbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#475569',
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  subCommentText: {
    fontSize: 12,
    color: '#e2e8f0',
    lineHeight: 17,
  },
  subCommentDateText: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 3,
  },
  replyInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  replyInput: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12,
    color: '#ffffff',
  },
  sendReplyBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addCommentFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 13,
  },
  sendCommentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  sendCommentBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});

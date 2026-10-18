import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type {
  Project,
  TaskItem,
  TaskStage,
  Subscription,
  PasswordItem,
  SavedPrompt,
  UserProfile,
  AuthResponse,
  TaskNotification,
} from './types';

const TOKEN_KEY = '@project_docs_auth_token';
const API_URL_KEY = '@project_docs_api_url';
const USER_KEY = '@project_docs_user_info';

export const PRODUCTION_API_URL = 'https://project-docs-nine.vercel.app';
export const KNOWN_WIFI_IP = '192.168.100.45';

// Default backend API URL: Vercel Cloud Production
export function getDefaultApiUrl(): string {
  return PRODUCTION_API_URL;
}

export function sanitizeApiUrl(rawUrl: string): string {
  let url = (rawUrl || '').trim();

  // 1. Ensure http:// or https:// prefix
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `http://${url}`;
  }

  // 2. Strip trailing slashes
  url = url.replace(/\/+$/, '');

  // 3. If user pasted 0.0.0.0 (from Next.js console), replace with actual Wi-Fi IP
  if (url.includes('0.0.0.0')) {
    url = url.replace('0.0.0.0', KNOWN_WIFI_IP);
  }

  // 4. If user appended /api or /api/auth or similar, remove it (endpoints already include /api)
  url = url.replace(/\/api(\/auth)?\/?$/, '');

  return url;
}

class ApiService {
  private currentUrl: string = sanitizeApiUrl(getDefaultApiUrl());
  private token: string | null = null;
  private isInitialized = false;

  async init(): Promise<void> {
    if (this.isInitialized) return;
    try {
      const [savedUrl, savedToken] = await Promise.all([
        AsyncStorage.getItem(API_URL_KEY),
        AsyncStorage.getItem(TOKEN_KEY),
      ]);

      if (savedUrl) {
        // If on native phone and savedUrl is localhost/127.0.0.1 or 0.0.0.0, auto-correct to laptop Wi-Fi IP
        if (
          savedUrl.includes('localhost') ||
          savedUrl.includes('127.0.0.1') ||
          savedUrl.includes('0.0.0.0') ||
          savedUrl.includes('192.168.') ||
          savedUrl.includes('10.0.2.2') ||
          savedUrl.endsWith('/api') ||
          savedUrl.endsWith('/api/auth')
        ) {
          const autoUrl = sanitizeApiUrl(PRODUCTION_API_URL);
          this.currentUrl = autoUrl;
          await AsyncStorage.setItem(API_URL_KEY, autoUrl);
        } else {
          this.currentUrl = sanitizeApiUrl(savedUrl);
        }
      } else {
        this.currentUrl = sanitizeApiUrl(getDefaultApiUrl());
      }

      if (savedToken) {
        this.token = savedToken;
      }
      this.isInitialized = true;
    } catch (e) {
      console.warn('Failed to load API settings from storage:', e);
    }
  }

  getApiUrl(): string {
    return this.currentUrl;
  }

  async setApiUrl(url: string): Promise<void> {
    const cleanUrl = sanitizeApiUrl(url);
    this.currentUrl = cleanUrl;
    await AsyncStorage.setItem(API_URL_KEY, cleanUrl);
  }

  getToken(): string | null {
    return this.token;
  }

  async setToken(token: string | null): Promise<void> {
    this.token = token;
    if (token) {
      await AsyncStorage.setItem(TOKEN_KEY, token);
    } else {
      await AsyncStorage.removeItem(TOKEN_KEY);
    }
  }

  private async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    await this.init();
    const cleanBase = sanitizeApiUrl(this.currentUrl);
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${cleanBase}${cleanEndpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const contentType = response.headers.get('content-type');
      const isJson = contentType && contentType.includes('application/json');
      const data = isJson ? await response.json() : await response.text();

      if (!response.ok) {
        const errorMsg =
          typeof data === 'object' && data?.error
            ? data.error
            : `Server responded with status ${response.status} (${url})`;
        throw new Error(errorMsg);
      }

      return data as T;
    } catch (err: any) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        throw new Error(`Connection to ${cleanBase} timed out after 12s.`);
      }
      throw err;
    }
  }

  // --- HEALTH & TEST ---
  async testConnection(customUrl?: string): Promise<{ ok: boolean; message: string }> {
    const targetUrl = sanitizeApiUrl(customUrl || this.currentUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    try {
      const testEndpoint = `${targetUrl}/api/auth`;
      const res = await fetch(testEndpoint, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.status >= 200 && res.status < 300) {
        return { ok: true, message: `Connected! Backend active at ${targetUrl}` };
      }

      if (res.status === 404) {
        return {
          ok: false,
          message: `Server returned 404 Not Found at ${testEndpoint}. Ensure the base URL is correct (e.g. ${PRODUCTION_API_URL}) without appending /api.`,
        };
      }

      return { ok: false, message: `Backend returned status ${res.status}` };
    } catch (err: any) {
      clearTimeout(timeout);
      return { ok: false, message: `Connection failed: ${err.message}` };
    }
  }

  // --- AUTH ---
  async login(username: string, password: string): Promise<AuthResponse> {
    const data = await this.request<AuthResponse>('/api/auth', {
      method: 'POST',
      body: JSON.stringify({ action: 'login', username, password }),
    });

    if (data.token) {
      await this.setToken(data.token);
    }
    if (data.user) {
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user));
    }
    return data;
  }

  async register(username: string, password: string, email?: string): Promise<AuthResponse> {
    const data = await this.request<AuthResponse>('/api/auth', {
      method: 'POST',
      body: JSON.stringify({ action: 'register', username, password, email }),
    });

    if (data.token) {
      await this.setToken(data.token);
    }
    if (data.user) {
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user));
    }
    return data;
  }

  async checkAuth(): Promise<AuthResponse> {
    try {
      const data = await this.request<AuthResponse>('/api/auth');
      return data;
    } catch (err) {
      return { authenticated: false };
    }
  }

  async logout(): Promise<void> {
    try {
      await this.request('/api/auth', { method: 'DELETE' });
    } catch {
      // ignore
    }
    await this.setToken(null);
    await AsyncStorage.removeItem(USER_KEY);
  }

  async getCachedUser(): Promise<any | null> {
    try {
      const raw = await AsyncStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  // --- PROJECTS ---
  async getProjects(): Promise<Project[]> {
    return this.request<Project[]>('/api/projects');
  }

  async createProject(name: string, sections: { id: number; heading: string; content: string }[] = []): Promise<Project> {
    const newProject: Project = {
      id: `project-${Date.now()}`,
      name,
      createdAt: Date.now(),
      sections: sections.length > 0 ? sections : [
        { id: 1, heading: 'Overview', content: 'Project created via Mobile Application.' }
      ],
      tasks: JSON.stringify([]),
    };

    const res = await this.request<{ success: boolean; project: Project }>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(newProject),
    });

    return res.project || newProject;
  }

  async deleteProject(id: string): Promise<void> {
    await this.request(`/api/projects?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  // --- TASKS ---
  async getTasks(projectId: string): Promise<TaskItem[]> {
    return this.request<TaskItem[]>(`/api/tasks?projectId=${encodeURIComponent(projectId)}`);
  }

  async createTask(params: {
    projectId: string;
    title?: string;
    heading: string;
    description?: string;
    stage?: TaskStage;
    comments?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<TaskItem> {
    const id = `task-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const headingText = (params.heading || params.title || '').trim();
    const res = await this.request<{ success: boolean; task: TaskItem } | TaskItem>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({
        id,
        projectId: params.projectId,
        title: headingText,
        heading: headingText,
        description: params.description || '',
        stage: params.stage || 'inprogress',
        comments: params.comments || '',
        startDate: params.startDate || '',
        endDate: params.endDate || '',
        createdAt: Date.now(),
      }),
    });

    if (res && typeof res === 'object' && 'task' in res && (res as any).task) {
      return (res as any).task;
    }
    return res as TaskItem;
  }

  async updateTask(task: TaskItem): Promise<TaskItem> {
    const headingText = (task.heading || task.title || '').trim();
    const res = await this.request<{ success: boolean; task: TaskItem } | TaskItem>('/api/tasks', {
      method: 'PUT',
      body: JSON.stringify({
        id: task.id,
        projectId: task.projectId,
        title: headingText,
        heading: headingText,
        description: task.description || '',
        stage: task.stage,
        comments: task.comments || '',
        startDate: task.startDate || '',
        endDate: task.endDate || '',
        createdAt: task.createdAt,
      }),
    });

    if (res && typeof res === 'object' && 'task' in res && (res as any).task) {
      return (res as any).task;
    }
    return res as TaskItem;
  }

  async updateTaskStage(
    taskId: string,
    projectId: string,
    stage: TaskStage,
    task?: TaskItem
  ): Promise<void> {
    const headingText = task?.heading || task?.title || '';
    await this.request('/api/tasks', {
      method: 'PUT',
      body: JSON.stringify({
        id: taskId,
        projectId,
        stage,
        heading: headingText,
        title: headingText,
        description: task?.description || '',
        comments: task?.comments || '',
        startDate: task?.startDate || '',
        endDate: task?.endDate || '',
        createdAt: task?.createdAt,
      }),
    });
  }

  async deleteTask(taskId: string, projectId: string): Promise<void> {
    await this.request(`/api/tasks?id=${encodeURIComponent(taskId)}&projectId=${encodeURIComponent(projectId)}`, {
      method: 'DELETE',
    });
  }

  // --- SUBSCRIPTIONS ---
  async getSubscriptions(): Promise<Subscription[]> {
    return this.request<Subscription[]>('/api/subscriptions');
  }

  async createSubscription(sub: Omit<Subscription, 'id' | 'createdAt'>): Promise<Subscription> {
    const newSub: Subscription = {
      ...sub,
      id: `sub-${Date.now()}`,
      createdAt: Date.now(),
    };
    return this.request<Subscription>('/api/subscriptions', {
      method: 'POST',
      body: JSON.stringify(newSub),
    });
  }

  async deleteSubscription(id: string): Promise<void> {
    await this.request(`/api/subscriptions?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  // --- PASSWORDS ---
  async getPasswords(): Promise<PasswordItem[]> {
    return this.request<PasswordItem[]>('/api/passwords');
  }

  async createPassword(item: Omit<PasswordItem, 'id' | 'createdAt'>): Promise<PasswordItem> {
    const newItem: PasswordItem = {
      ...item,
      id: `pwd-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    return this.request<PasswordItem>('/api/passwords', {
      method: 'POST',
      body: JSON.stringify(newItem),
    });
  }

  async deletePassword(id: string): Promise<void> {
    await this.request(`/api/passwords?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  // --- PROMPTS ---
  async getPrompts(): Promise<SavedPrompt[]> {
    return this.request<SavedPrompt[]>('/api/prompts');
  }

  async createPrompt(prompt: { heading: string; description: string; prompt: string }): Promise<SavedPrompt> {
    return this.request<SavedPrompt>('/api/prompts', {
      method: 'POST',
      body: JSON.stringify(prompt),
    });
  }

  async deletePrompt(id: string): Promise<void> {
    await this.request(`/api/prompts?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  // --- NOTIFICATIONS & PUSH TOKENS ---
  async getNotifications(): Promise<{ notifications: TaskNotification[]; unreadCount: number }> {
    return this.request<{ notifications: TaskNotification[]; unreadCount: number }>('/api/notifications');
  }

  async markNotificationRead(id: string): Promise<void> {
    await this.request('/api/notifications', {
      method: 'POST',
      body: JSON.stringify({ action: 'mark_read', id }),
    });
  }

  async markNotificationUnread(id: string): Promise<void> {
    await this.request('/api/notifications', {
      method: 'POST',
      body: JSON.stringify({ action: 'mark_unread', id }),
    });
  }

  async markAllNotificationsRead(): Promise<void> {
    await this.request('/api/notifications', {
      method: 'POST',
      body: JSON.stringify({ action: 'mark_all_read' }),
    });
  }

  async deleteNotification(id: string): Promise<void> {
    await this.request('/api/notifications', {
      method: 'POST',
      body: JSON.stringify({ action: 'delete', id }),
    });
  }

  async clearAllNotifications(): Promise<void> {
    await this.request('/api/notifications', {
      method: 'POST',
      body: JSON.stringify({ action: 'clear_all' }),
    });
  }

  async registerPushToken(pushToken: string): Promise<void> {
    try {
      await this.request('/api/notifications/push-token', {
        method: 'POST',
        body: JSON.stringify({ pushToken }),
      });
    } catch (e: any) {
      console.warn('Failed to register push token with server:', e.message);
    }
  }
}

export const api = new ApiService();

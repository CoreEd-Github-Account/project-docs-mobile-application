export interface Section {
  id: number;
  heading: string;
  content: string;
}

export type TaskStage = "completed" | "inprogress" | "stopped";

export interface TaskSubComment {
  id: string;
  text: string;
  createdAt: number;
  dateTime?: string;
  completed?: boolean;
}

export interface TaskComment {
  id: string;
  text: string;
  createdAt: number;
  dateTime?: string;
  completed?: boolean;
  subComments?: TaskSubComment[];
}

export interface TaskItem {
  id: string;
  title: string;
  heading?: string;
  description?: string;
  stage: TaskStage;
  comments?: string;
  startDate?: string;
  endDate?: string;
  createdAt?: number;
  projectId?: string;
  userId?: string;
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  sections?: Section[];
  tasks?: string;
  userId?: string;
  currentUserPermission?: string;
  isOwner?: boolean;
}

export interface Subscription {
  id: string;
  name: string;
  amount: number;
  purchaseDate: string; // YYYY-MM-DD
  renewalDate: string;  // YYYY-MM-DD
  createdAt?: number;
  userId?: string;
}

export interface PasswordItem {
  id: string;
  projectName: string;
  url: string;
  identifier: string; // ID / Username / Email
  password: string;   // Plain text
  createdAt: string;
  userId?: string;
}

export interface SavedPrompt {
  id: string;
  heading: string;
  description: string;
  prompt: string;
  createdAt: string;
  userId?: string;
}

export interface UserProfile {
  id: string;
  username: string;
  email?: string;
  fullName?: string;
  bio?: string;
  avatarUrl?: string;
}

export interface AuthResponse {
  success?: boolean;
  authenticated: boolean;
  token?: string;
  user?: {
    id: string;
    username: string;
    fullName?: string;
    email?: string;
    avatarUrl?: string;
  };
  error?: string;
}

export interface TaskNotification {
  id: string;
  userId: string;
  projectId: string;
  projectName?: string;
  taskId?: string;
  taskHeading?: string;
  actorId: string;
  actorName?: string;
  actorFullName?: string;
  actorAvatar?: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

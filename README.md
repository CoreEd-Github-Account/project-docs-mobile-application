# Project Docs - Mobile Application 📱

A modern mobile companion application built with **React Native**, **Expo (SDK 57)**, and **Expo Router**, fully integrated with the **Project Docs** web application backend and **PostgreSQL (Supabase)** database.

---

## ✨ Features

- **🔐 Secure Authentication**:
  - Sign In and Sign Up with cryptographic HS256 JWT sessions.
  - One-tap quick demo user fill (`admin`, `tasneem`, `ubaid`).
  - Auto-fallback to local cached session on app restart.
  - Server URL config with real-time backend connection ping tester.

- **📁 Projects & Documentation**:
  - Browse projects directly synchronized with the PostgreSQL database.
  - Create new projects with custom initial sections.
  - Full documentation viewer with expandable section notes and requirements.
  - Add new sections to existing projects on the fly.
  - Search and filter projects.

- **✅ Task Tracker & Kanban**:
  - Real-time project task list.
  - Filter tasks by stages: `All`, `In Progress`, `Completed`, `Stopped`.
  - One-tap interactive stage switcher directly on task cards.
  - Add new tasks with title, description, and target stage.
  - Delete completed tasks.

- **🔐 Workspace Vault**:
  - **Subscriptions Tracker**: Track monthly software expenses, renewal dates, and total recurring monthly spend.
  - **Password Credentials Vault**: Safe project credentials manager with show/hide password toggle.
  - **Prompt Library**: Save AI system prompts and documentation guidelines for quick copy and reuse.

- **⚙️ Profile & Settings**:
  - User details & avatar.
  - Backend API URL switcher (Localhost, Android Emulator `10.0.2.2:3000`, or local network IP).
  - Real-time server latency ping tester.
  - Database & infrastructure overview.

---

## 🛠️ Tech Stack & Architecture

- **Framework**: Expo (SDK 57) + React Native 0.86 + React 19
- **Navigation**: Expo Router (Universal Tab Navigation)
- **Local Storage**: `@react-native-async-storage/async-storage`
- **Icons**: `@expo/vector-icons` (Ionicons)
- **Backend**: Next.js 16 REST API (`web-application`)
- **Database**: PostgreSQL on Supabase (`aws-0-ap-southeast-2.pooler.supabase.com`)

---

## 🚀 Getting Started

### 1. Start the Backend (`web-application`)

First, ensure the web application backend is running:

```bash
cd ../web-application
npm run dev
```

The backend will start at `http://localhost:3000`.

### 2. Start the Mobile Application (`mobile-application`)

In a new terminal:

```bash
cd mobile-application
npm.cmd start
# or
npx.cmd expo start
```

### 3. Open on Your Preferred Device

- **Web Browser**: Press `w` in terminal or run `npm.cmd run web`.
- **Android Device / Emulator**: Press `a` in terminal.
  - *Tip for Android Emulator*: Set backend URL in Settings to `http://10.0.2.2:3000`.
- **iOS Simulator**: Press `i` in terminal.
- **Physical Device (Expo Go)**:
  - Install **Expo Go** from Google Play or Apple App Store.
  - Scan the QR code shown in the terminal.
  - Set the backend URL in Settings to your computer's local IP (e.g. `http://192.168.x.x:3000`).

---

## 🔗 Backend API Endpoints Used

| Feature | Method & Endpoint |
|---|---|
| Auth / Profile | `GET /api/auth`, `POST /api/auth`, `DELETE /api/auth` |
| Projects | `GET /api/projects`, `POST /api/projects`, `DELETE /api/projects` |
| Tasks | `GET /api/tasks?projectId=...`, `POST /api/tasks`, `PUT /api/tasks`, `DELETE /api/tasks` |
| Subscriptions | `GET /api/subscriptions`, `POST /api/subscriptions`, `DELETE /api/subscriptions` |
| Passwords | `GET /api/passwords`, `POST /api/passwords`, `DELETE /api/passwords` |
| Prompts | `GET /api/prompts`, `POST /api/prompts`, `DELETE /api/prompts` |

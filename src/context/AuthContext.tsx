import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api } from '@/services/api';
import type { UserProfile } from '@/services/types';

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  apiUrl: string;
  setApiUrl: (url: string) => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, email?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [apiUrl, setApiUrlState] = useState<string>(api.getApiUrl());

  useEffect(() => {
    let isMounted = true;

    async function loadAuth() {
      try {
        await api.init();
        if (!isMounted) return;
        setApiUrlState(api.getApiUrl());

        // Fast load cached user
        const cachedUser = await api.getCachedUser();
        if (cachedUser && isMounted) {
          setUser(cachedUser);
          setIsAuthenticated(true);
        }

        // Verify with server if token is present
        if (api.getToken()) {
          const authRes = await api.checkAuth();
          if (isMounted) {
            if (authRes.authenticated && authRes.user) {
              setUser(authRes.user as UserProfile);
              setIsAuthenticated(true);
            } else {
              // Token expired or invalid
              setUser(null);
              setIsAuthenticated(false);
            }
          }
        }
      } catch (err) {
        console.warn('Auth initialization error:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const setApiUrl = useCallback(async (url: string) => {
    await api.setApiUrl(url);
    setApiUrlState(api.getApiUrl());
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await api.login(username, password);
    if (res.user) {
      setUser(res.user as UserProfile);
      setIsAuthenticated(true);
    }
  }, []);

  const register = useCallback(async (username: string, password: string, email?: string) => {
    const res = await api.register(username, password, email);
    if (res.user) {
      setUser(res.user as UserProfile);
      setIsAuthenticated(true);
    }
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const authRes = await api.checkAuth();
      if (authRes.authenticated && authRes.user) {
        setUser((prev) => {
          if (
            prev &&
            prev.id === authRes.user?.id &&
            prev.username === authRes.user?.username &&
            prev.fullName === authRes.user?.fullName
          ) {
            return prev;
          }
          return authRes.user as UserProfile;
        });
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch {
      // Ignore network errors in background
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        apiUrl,
        setApiUrl,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

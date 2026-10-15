import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, UserRole, Workspace, NotificationItem } from '../types/index.js';
import { apiRequest } from '../api/client.js';

interface AuthContextType {
  user: User | null;
  activeWorkspace: Workspace | null;
  workspaces: Workspace[];
  notifications: NotificationItem[];
  unreadNotificationsCount: number;
  isLoading: boolean;
  login: (username: string, password?: string) => Promise<void>;
  signup: (data: {
    username: string;
    email: string;
    displayName: string;
    password: string;
    invitationToken?: string;
    workspaceName?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: {
    displayName?: string;
    avatarUrl?: string;
    currentPassword?: string;
    newPassword?: string;
  }) => Promise<void>;
  switchWorkspace: (workspaceId: string) => Promise<void>;
  refreshNotifications: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  hasRole: (role: UserRole) => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const data = await apiRequest('/api/notifications');
      setNotifications(data.notifications || []);
      setUnreadNotificationsCount(data.unreadCount || 0);
    } catch {
      // Silently ignore if unauthenticated
    }
  }, [user]);

  const refreshUser = useCallback(async () => {
    try {
      const data = await apiRequest('/api/auth/me');
      setUser(data.user);
      setActiveWorkspace(data.activeWorkspace || null);
      setWorkspaces(data.workspaces || []);
    } catch {
      setUser(null);
      setActiveWorkspace(null);
      setWorkspaces([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    if (user) {
      refreshNotifications();
      const interval = setInterval(refreshNotifications, 15000);
      return () => clearInterval(interval);
    }
  }, [user, refreshNotifications]);

  const login = async (username: string, password = 'Terminal6#Studio') => {
    setIsLoading(true);
    try {
      const data = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      setUser(data.user);
      setActiveWorkspace(data.activeWorkspace || null);
      setWorkspaces(data.workspaces || []);
      await refreshNotifications();
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (data: {
    username: string;
    email: string;
    displayName: string;
    password: string;
    invitationToken?: string;
    workspaceName?: string;
  }) => {
    setIsLoading(true);
    try {
      const res = await apiRequest('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      setUser(res.user);
      setActiveWorkspace(res.activeWorkspace || null);
      setWorkspaces(res.workspaces || []);
      await refreshNotifications();
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
      setActiveWorkspace(null);
      setWorkspaces([]);
      setNotifications([]);
      setUnreadNotificationsCount(0);
    }
  };

  const updateProfile = async (data: {
    displayName?: string;
    avatarUrl?: string;
    currentPassword?: string;
    newPassword?: string;
  }) => {
    const res = await apiRequest('/api/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
    setUser(res.user);
    if (res.activeWorkspace) setActiveWorkspace(res.activeWorkspace);
    if (res.workspaces) setWorkspaces(res.workspaces);
  };

  const switchWorkspace = async (workspaceId: string) => {
    const res = await apiRequest('/api/auth/workspace/switch', {
      method: 'POST',
      body: JSON.stringify({ workspaceId })
    });
    if (res.activeWorkspace) setActiveWorkspace(res.activeWorkspace);
    if (res.workspaces) setWorkspaces(res.workspaces);
    if (user) {
      setUser({ ...user, workspaceId });
    }
  };

  const markNotificationRead = async (id: string) => {
    try {
      const res = await apiRequest(`/api/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
      setUnreadNotificationsCount(res.unreadCount);
    } catch {
      // Ignore
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      await apiRequest('/api/notifications/read-all', { method: 'POST' });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      setUnreadNotificationsCount(0);
    } catch {
      // Ignore
    }
  };

  const hasRole = (role: UserRole): boolean => {
    if (!user || !user.roles) return false;
    return user.roles.includes(role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        activeWorkspace,
        workspaces,
        notifications,
        unreadNotificationsCount,
        isLoading,
        login,
        signup,
        logout,
        updateProfile,
        switchWorkspace,
        refreshNotifications,
        markNotificationRead,
        markAllNotificationsRead,
        hasRole,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

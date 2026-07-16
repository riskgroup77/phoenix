import * as React from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Notification } from '../types';
import { apiService } from '../services/apiService';

export interface LoginResult {
  ok: boolean;
  message: string | null;
}

interface AuthContextType {
  user: User | null;
  login: (phone: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  loading: boolean;
  error: string | null;
  // Notification state and functions
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'read'>) => void;
  markAsRead: (id: number) => void;
  markAllAsRead: () => void;
  unreadCount: number;
}

// Create the context with a default value that matches AuthContextType
const AuthContext = createContext<AuthContextType>({
  user: null,
  login: async () => ({ ok: false, message: null }),
  logout: async () => {},
  loading: false,
  error: null,
  notifications: [],
  addNotification: () => {},
  markAsRead: () => {},
  markAllAsRead: () => {},
  unreadCount: 0,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const notificationIdCounter = React.useRef<number>(Date.now());

  const refreshNotifications = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;
      const notificationsData = await apiService.notifications.list();
      const notificationsArray = Array.isArray(notificationsData)
        ? notificationsData
        : (notificationsData?.data && Array.isArray(notificationsData.data)
            ? notificationsData.data
            : []);
      const mappedNotifications: Notification[] = notificationsArray.map((n: any) => ({
        id: n.id,
        message: n.message,
        read: n.read,
        link: n.link || undefined
      }));
      setNotifications(mappedNotifications);
    } catch {
      // polling xatolari UI ni buzmasin
    }
  }, []);

  // Load user from localStorage on initial load
  useEffect(() => {
    const loadUser = async () => {
      try {
        const token = localStorage.getItem('access_token');
        if (!token) {
          setLoading(false);
          return;
        }

        try {
          const response = await apiService.auth.getProfile();
          const userData = response?.data || response;
          
          if (!userData) {
            throw new Error('No user data in response');
          }
          
          // Map the API response to our User type
          const user: User = {
            id: userData.id || '',
            firstName: userData.first_name || userData.firstName || '',
            lastName: userData.last_name || userData.lastName || '',
            patronymic: userData.patronymic || '',
            email: userData.email || '',
            phone: userData.phone || '',
            role: userData.role || 'author',
            affiliation: userData.affiliation || '',
            gamificationProfile: userData.gamification_profile || {
              level: 'Beginner',
              badges: [],
              points: 0
            },
            avatarUrl: userData.avatar_url || userData.avatarUrl || '',
            telegramUsername: userData.telegram_username || userData.telegramUsername || ''
          };
          
          setUser(user);
          
          await refreshNotifications();
        } catch (profileError: any) {
          const msg = profileError?.message ?? '';
          const isSessionExpired = msg.includes('sessiya') || profileError?.status === 401;
          const isNetwork = msg.includes('Serverga ulanib') || profileError?.code === 'NETWORK_ERROR' || profileError?.name === 'TypeError';
          if (isNetwork) {
            setUser(null);
            setLoading(false);
            return;
          }
          if (!isSessionExpired) {
            console.error('Failed to fetch user profile:', profileError);
          }
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          setTimeout(() => navigate('/login'), 0);
        }
      } catch (error: any) {
        const msg = error?.message ?? '';
        const isSessionExpired = msg.includes('sessiya') || error?.status === 401;
        const isNetwork = msg.includes('Serverga ulanib') || error?.code === 'NETWORK_ERROR' || error?.name === 'TypeError';
        if (isNetwork) {
          setUser(null);
          setLoading(false);
          return;
        }
        if (!isSessionExpired) {
          console.error('Error in loadUser:', error);
        }
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        setTimeout(() => navigate('/login'), 0);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [navigate, refreshNotifications]);

  // Bell bildirgilarini yangilab turish (DOI, taqriz va boshqalar real-time ko'rinsin)
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    refreshNotifications();
    const t = window.setInterval(() => {
      if (!cancelled) refreshNotifications();
    }, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [user, refreshNotifications]);

  const login = async (phone: string, password: string): Promise<LoginResult> => {
    setLoading(true);
    setError(null);
    
    try {
      // Ensure phone number doesn't have + sign and normalize
      const cleanPhone = phone.replace(/^\+/, '').replace(/\s/g, '').replace(/\D/g, '');
      
      // Validate phone number (should be 9-12 digits)
      // 9 digits: 907863888 -> backend will add 998
      // 12 digits: 998907863888 -> backend will use as-is
      if (!cleanPhone || cleanPhone.length < 9 || cleanPhone.length > 12) {
        const msg = 'Iltimos, to\'g\'ri telefon raqamni kiriting (9-12 ta raqam).';
        setError(msg);
        setLoading(false);
        return { ok: false, message: msg };
      }
      
      if (!password || password.trim().length === 0) {
        const msg = 'Iltimos, parolni kiriting.';
        setError(msg);
        setLoading(false);
        return { ok: false, message: msg };
      }
      
      const response = await apiService.auth.login(cleanPhone, password);
      
      // Handle different response formats
      const responseData = response?.data || response;
      
      // Extract tokens and user data from different possible response structures
      const accessToken = responseData?.access || responseData?.access_token;
      const refreshToken = responseData?.refresh || responseData?.refresh_token;
      const userData = responseData?.user || responseData;
      
      if (accessToken) {
        localStorage.setItem('access_token', accessToken);
        if (refreshToken) {
          localStorage.setItem('refresh_token', refreshToken);
        }

        // If we have user data in the response, use it directly
        if (userData?.id) {
          const user: User = {
            id: userData.id,
            firstName: userData.first_name || userData.firstName || '',
            lastName: userData.last_name || userData.lastName || '',
            patronymic: userData.patronymic || '',
            email: userData.email || '',
            phone: userData.phone || phone,
            role: userData.role || 'author',
            affiliation: userData.affiliation || '',
            gamificationProfile: userData.gamification_profile || userData.gamificationProfile || {
              level: 'Beginner',
              badges: [],
              points: 0
            },
            avatarUrl: userData.avatar_url || userData.avatarUrl || '',
            telegramUsername: userData.telegram_username || userData.telegramUsername || ''
          };
          
          setUser(user);
          setError(null);
          return { ok: true, message: null };
        }
        
        // If no user data in response, try to fetch it
        try {
          const profileResponse = await apiService.auth.getProfile();
          const profileData = profileResponse?.data ?? profileResponse;
          if (profileData?.id) {
            const user: User = {
              id: profileData.id,
              firstName: profileData.first_name || profileData.firstName || '',
              lastName: profileData.last_name || profileData.lastName || '',
              patronymic: profileData.patronymic || '',
              email: profileData.email || '',
              phone: profileData.phone || phone,
              role: profileData.role || 'author',
              affiliation: profileData.affiliation || '',
              gamificationProfile: profileData.gamification_profile || {
                level: 'Beginner',
                badges: [],
                points: 0
              },
              avatarUrl: profileData.avatar_url || profileData.avatarUrl || '',
              telegramUsername: profileData.telegram_username || profileData.telegramUsername || ''
            };
            setUser(user);
          }
          setError(null);
          return { ok: true, message: null };
        } catch (profileError) {
          console.error('Failed to fetch user profile:', profileError);
          return { ok: true, message: null };
        }
      }
      
      const msg = 'Server javobida token topilmadi. Iltimos, qayta urinib ko\'ring.';
      setError(msg);
      return { ok: false, message: msg };
    } catch (error: any) {
      let errorMessage = 'Kirishda xatolik. Telefon raqam va parolni tekshiring.';
      const body = error?.response;
      if (body && typeof body === 'object' && body !== null) {
        const nested = (body as { data?: unknown }).data;
        const src =
          nested && typeof nested === 'object'
            ? (nested as Record<string, unknown>)
            : (body as Record<string, unknown>);
        const nfe = src.non_field_errors;
        if (Array.isArray(nfe) && nfe.length > 0) {
          errorMessage = String(nfe[0]);
        } else if (typeof src.detail === 'string' && src.detail) {
          errorMessage = src.detail;
        } else if (Array.isArray(src.phone) && src.phone.length > 0) {
          errorMessage = String(src.phone[0]);
        } else if (Array.isArray(src.password) && src.password.length > 0) {
          errorMessage = String(src.password[0]);
        } else if (error?.message) {
          errorMessage = error.message;
        }
      } else if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      setError(errorMessage);
      return { ok: false, message: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const logout = useCallback(async () => {
    await apiService.auth.logout();
    setUser(null);
    navigate('/login');
  }, [navigate]);

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'read'>) => {
    const newNotification = {
      ...notification,
      id: notificationIdCounter.current++,
      read: false,
    };
    setNotifications(prev => [newNotification, ...prev].slice(0, 20));
  }, []);

  const markAsRead = useCallback((id: number) => {
    // Update local state immediately for UI responsiveness
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );
    
    // Also update backend
    apiService.notifications.markRead(id.toString()).catch(error => {
      console.error('Failed to mark notification as read on backend:', error);
      // If backend update fails, we could revert the local change
      // but for now we'll just log the error and keep the UI updated
    });
  }, []);

  const markAllAsRead = useCallback(() => {
    // Update local state immediately for UI responsiveness
    setNotifications(prev =>
      prev.map(n => ({ ...n, read: true }))
    );
    
    // Also update backend
    apiService.notifications.markAllRead().catch(error => {
      console.error('Failed to mark all notifications as read on backend:', error);
      // If backend update fails, we could revert the local change
      // but for now we'll just log the error and keep the UI updated
    });
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const contextValue: AuthContextType = {
    user,
    login,
    logout,
    loading,
    error,
    notifications,
    addNotification,
    markAsRead,
    markAllAsRead,
    unreadCount,
  };

  return React.createElement(
    AuthContext.Provider,
    { value: contextValue },
    children
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const useNotifications = () => {
  const { notifications, addNotification, markAsRead, markAllAsRead, unreadCount } = useAuth();
  return { notifications, addNotification, markAsRead, markAllAsRead, unreadCount };
};
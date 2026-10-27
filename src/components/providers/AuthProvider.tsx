'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { SafeUser } from '@/types';

export interface UserTeamSummary {
  id: string;
  name: string;
  tag: string;
  logoUrl: string | null;
  isOwner: boolean;
}

export interface AuthUser extends SafeUser {
  unreadNotifications: number;
  teams: UserTeamSummary[];
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  refreshUser: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchSession = useCallback(async (retryCount = 0): Promise<void> => {
    try {
      const res = await fetch('/api/me', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          setUser(data.data);
          setLoading(false);
          return;
        }
      }

      // If server returned 5xx or server is cold-starting right after deploy, retry gracefully
      if (res.status >= 500 && retryCount < 3) {
        console.warn(`[AuthProvider] Server busy or warming up (${res.status}), retrying in ${(retryCount + 1) * 1000}ms...`);
        retryTimeoutRef.current = setTimeout(() => {
          fetchSession(retryCount + 1);
        }, (retryCount + 1) * 1000);
        return;
      }

      // If 401 Unauthorized, verify that it wasn't a transient server error
      if (res.status === 401) {
        setUser(null);
      }
    } catch (err) {
      console.warn('[AuthProvider] Network error while fetching session:', err);
      // If network failed (e.g. Render restart/deploy in progress), retry before giving up
      if (retryCount < 3) {
        retryTimeoutRef.current = setTimeout(() => {
          fetchSession(retryCount + 1);
        }, 1500);
        return;
      }
      setUser(null);
    } finally {
      if (retryCount === 0 || retryCount >= 2) {
        setLoading(false);
      }
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }
    await fetchSession(0);
  }, [fetchSession]);

  const logout = useCallback(async () => {
    try {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Logout error:', err);
    }
  }, [router]);

  useEffect(() => {
    fetchSession(0);
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [fetchSession]);

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useUser() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useUser must be used within an AuthProvider');
  }
  return context;
}

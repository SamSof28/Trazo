import { create } from 'zustand';
import type { PublicUser } from '@trazo/shared';
import {
  fetchCurrentUser,
  loginRequest,
  logoutRequest,
  refreshSession,
  setAccessToken,
} from '../../shared/api/client';

interface AuthState {
  user: PublicUser | null;
  status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated';
  setSession: (user: PublicUser, token: string) => void;
  restoreSession: () => Promise<boolean>;
  login: (email: string, password: string) => Promise<PublicUser>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'idle',

  setSession: (user, token) => {
    setAccessToken(token);
    set({ user, status: 'authenticated' });
  },

  restoreSession: async () => {
    set({ status: 'loading' });
    try {
      const refreshed = await refreshSession();
      if (!refreshed) {
        set({ user: null, status: 'unauthenticated' });
        return false;
      }
      const user = await fetchCurrentUser();
      set({ user, status: 'authenticated' });
      return true;
    } catch {
      setAccessToken(null);
      set({ user: null, status: 'unauthenticated' });
      return false;
    }
  },

  login: async (email, password) => {
    set({ status: 'loading' });
    try {
      const session = await loginRequest(email, password);
      set({ user: session.user, status: 'authenticated' });
      return session.user;
    } catch (err) {
      set({ user: null, status: 'unauthenticated' });
      throw err;
    }
  },

  logout: async () => {
    try {
      await logoutRequest();
    } finally {
      set({ user: null, status: 'unauthenticated' });
    }
  },
}));

import { create } from "zustand";
import type { User } from "@/types";
import api from "@/api/client";
import { TG_TOKEN_KEY, TG_REFRESH_KEY } from "@/utils/telegram";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => void;
  checkAuth: () => Promise<void>;
  refreshUser: () => Promise<void>;
  telegramAuth: (initData: string) => Promise<{ is_new_user: boolean; tg_name: string }>;
  telegramMiniAppAuth: (telegramId: string, firstName: string, username?: string) => Promise<{ is_new_user: boolean }>;
  requestTgCode: (username: string) => Promise<{ request_id: string; code: string; bot_username: string; expires_in: number }>;
  checkTgCode: (requestId: string) => Promise<{ status: string; is_new_user?: boolean }>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  logout: () => {
    api.post("/auth/logout").catch(() => {});
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  checkAuth: async () => {
    // Guarantee isLoading flips off even if the network request hangs — the
    // login flow gracefully recovers from a missing user, but a stuck spinner
    // is what users see as "page never loads".
    const safetyTimer = setTimeout(() => {
      set((s) => (s.isLoading ? { ...s, isLoading: false } : s));
    }, 8000);
    try {
      const { data } = await api.get("/user/me");
      set({ user: data, isAuthenticated: true, isLoading: false });
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    } finally {
      clearTimeout(safetyTimer);
    }
  },

  refreshUser: async () => {
    try {
      const { data } = await api.get("/user/me");
      set({ user: data });
    } catch {
      // ignore
    }
  },

  telegramAuth: async (initData: string) => {
    const { data } = await api.post("/auth/telegram", { init_data: initData });
    localStorage.setItem(TG_TOKEN_KEY, data.access_token);
    localStorage.setItem(TG_REFRESH_KEY, data.refresh_token);
    set({ isAuthenticated: true, isLoading: false });
    try {
      const { data: userData } = await api.get("/user/me");
      set({ user: userData });
    } catch { /* ignore */ }
    return data;
  },

  telegramMiniAppAuth: async (telegramId: string, firstName: string, username?: string) => {
    const { data } = await api.post("/auth/tg/mini-app", {
      telegram_id: telegramId,
      first_name: firstName,
      username: username || null,
    });
    set({ isAuthenticated: true, isLoading: false });
    try {
      const { data: userData } = await api.get("/user/me");
      set({ user: userData });
    } catch { /* ignore */ }
    return data;
  },

  requestTgCode: async (username: string) => {
    const { data } = await api.post("/auth/tg/request-code", { telegram_username: username || null });
    return data;
  },

  checkTgCode: async (requestId: string) => {
    const { data } = await api.get(`/auth/tg/check/${requestId}`);
    if (data.status === "verified") {
      set({ isAuthenticated: true, isLoading: false });
      try {
        const { data: userData } = await api.get("/user/me");
        set({ user: userData });
      } catch { /* ignore */ }
    }
    return data;
  },
}));

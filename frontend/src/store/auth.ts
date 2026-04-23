import { create } from "zustand";
import type { User } from "@/types";
import api from "@/api/client";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  sendCode: (email: string) => Promise<{ user_exists: boolean }>;
  verifyCode: (email: string, code: string) => Promise<{ is_new_user: boolean }>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  sendCode: async (email) => {
    const { data } = await api.post("/auth/send-code", { email });
    return data;
  },

  verifyCode: async (email, code) => {
    const { data } = await api.post("/auth/verify-code", { email, code });
    set({ isAuthenticated: true, isLoading: false });
    return data;
  },

  login: async (email, password) => {
    await api.post("/auth/login", { email, password });
    set({ isAuthenticated: true, isLoading: false });
  },

  register: async (email, password, name) => {
    await api.post("/auth/register", { email, password, name });
    set({ isAuthenticated: true, isLoading: false });
  },

  logout: () => {
    api.post("/auth/logout").catch(() => {});
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  checkAuth: async () => {
    try {
      const { data } = await api.get("/user/me");
      set({ user: data, isAuthenticated: true, isLoading: false });
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
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
}));

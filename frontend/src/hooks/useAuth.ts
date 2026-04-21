import { useAuthStore } from "@/store/auth";

export function useAuth() {
  const { user, isLoading, isAuthenticated, login, register, logout } =
    useAuthStore();

  return { user, isLoading, isAuthenticated, login, register, logout };
}

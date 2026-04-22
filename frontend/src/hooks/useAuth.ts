import { useAuthStore } from "@/store/auth";

export function useAuth() {
  const { user, isLoading, isAuthenticated, login, register, logout, refreshUser } =
    useAuthStore();

  return { user, isLoading, isAuthenticated, login, register, logout, refreshUser };
}

import { useAuthStore } from "@/store/auth";

export function useAuth() {
  const { user, isLoading, isAuthenticated, logout, refreshUser } =
    useAuthStore();

  return { user, isLoading, isAuthenticated, logout, refreshUser };
}

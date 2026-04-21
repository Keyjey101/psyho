import { useEffect } from "react";
import { useAuthStore } from "@/store/auth";

export function useAuth() {
  const { user, isLoading, isAuthenticated, login, register, logout, checkAuth } =
    useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return { user, isLoading, isAuthenticated, login, register, logout };
}

import { useEffect } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAuthStore } from "@/store/auth";
import { isTMA, initTelegramApp, getInitData } from "@/utils/telegram";
import AuthEmail from "@/pages/AuthEmail";
import AuthVerify from "@/pages/AuthVerify";
import AuthTelegram from "@/pages/AuthTelegram";
import Chat from "@/pages/Chat";
import Admin from "@/pages/Admin";
import OnboardingFlow from "@/pages/OnboardingFlow";
import Profile from "@/pages/Profile";
import MoodPage from "@/pages/MoodPage";
import PersonalityPage from "@/pages/PersonalityPage";
import Landing from "@/pages/Landing";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#FAF6F1] dark:bg-[#2A2420]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#E8DDD0] border-t-[#B8785A] dark:border-[#4A4038] dark:border-t-[#C08B68]" />
          <p className="text-sm text-[#8A7A6A] dark:text-[#B8A898]">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const checkAuth = useAuthStore((s) => s.checkAuth);
  const telegramAuth = useAuthStore((s) => s.telegramAuth);
  const navigate = useNavigate();

  useEffect(() => {
    if (isTMA()) {
      initTelegramApp();
      const initData = getInitData();
      if (initData) {
        telegramAuth(initData)
          .then((data) => {
            if (data.is_new_user) navigate("/onboarding", { replace: true });
            else navigate("/chat", { replace: true });
          })
          .catch(() => {
            checkAuth();
          });
      } else {
        checkAuth();
      }
    } else {
      checkAuth();
    }
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, [checkAuth, telegramAuth, navigate]);

  return (
    <Routes>
      <Route path="/" element={<Landing />} />

      <Route path="/auth" element={<AuthTelegram />} />
      <Route path="/auth/email" element={<AuthEmail />} />
      <Route path="/auth/verify" element={<AuthVerify />} />

      <Route path="/login" element={<Navigate to="/auth" replace />} />
      <Route path="/register" element={<Navigate to="/auth" replace />} />

      <Route
        path="/chat/:sessionId?"
        element={
          <ProtectedRoute>
            <Chat />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <Admin />
          </ProtectedRoute>
        }
      />
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <OnboardingFlow />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/mood"
        element={
          <ProtectedRoute>
            <MoodPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/personality"
        element={
          <ProtectedRoute>
            <PersonalityPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/chat" replace />} />
    </Routes>
  );
}

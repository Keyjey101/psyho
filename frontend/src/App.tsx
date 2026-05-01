import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAuthStore } from "@/store/auth";
import { isTMA, initTelegramApp } from "@/utils/telegram";
import AuthTelegram from "@/pages/AuthTelegram";
import Chat from "@/pages/Chat";
import Admin from "@/pages/Admin";
import OnboardingFlow from "@/pages/OnboardingFlow";
import Profile from "@/pages/Profile";
import MoodPage from "@/pages/MoodPage";
import PersonalityPage from "@/pages/PersonalityPage";
import Landing from "@/pages/Landing";
import EmotionMap from "@/pages/EmotionMap";
import DiaryPage from "@/pages/DiaryPage";
import TimeCapsulePage from "@/pages/TimeCapsulePage";

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

  useEffect(() => {
    // Telegram Web App SDK is loaded async. Try immediately and again once
    // the script has had a chance to attach window.Telegram (it's small and
    // usually arrives within a second).
    const tryInitTma = () => {
      if (isTMA()) initTelegramApp();
    };
    tryInitTma();
    const tmaTimer = setTimeout(tryInitTma, 1500);

    checkAuth();
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    return () => clearTimeout(tmaTimer);
  }, [checkAuth]);

  return (
    <Routes>
      <Route path="/" element={<Landing />} />

      <Route path="/auth" element={<AuthTelegram />} />

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
      <Route
        path="/emotion-map"
        element={
          <ProtectedRoute>
            <EmotionMap />
          </ProtectedRoute>
        }
      />
      <Route
        path="/diary"
        element={
          <ProtectedRoute>
            <DiaryPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/time-capsule"
        element={
          <ProtectedRoute>
            <TimeCapsulePage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAuthStore } from "@/store/auth";
import { useUtm } from "@/hooks/useUtm";
import { isTMA, initTelegramApp, waitForTelegramSdk } from "@/utils/telegram";
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
import TestsPage from "@/pages/TestsPage";
import TestRunnerPage from "@/pages/TestRunnerPage";
import TestLandingPage from "@/pages/TestLandingPage";
import GamePage from "@/pages/GamePage";
import { GAME_ON } from "@/utils/features";
import Pricing from "@/pages/Pricing";
import Subscription from "@/pages/Subscription";
import Offer from "@/pages/legal/Offer";
import Refund from "@/pages/legal/Refund";
import Privacy from "@/pages/legal/Privacy";
import Consent from "@/pages/legal/Consent";

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

  // App-wide, not landing-only: ads point straight at /test/<slug>, so
  // attribution has to be captured wherever the visitor first arrives.
  useUtm();

  useEffect(() => {
    // Telegram Web App SDK is loaded async. Try immediately, then poll up
    // to 3s for the script to attach window.Telegram — on slow Android
    // builds the SDK can take 1-2s to inject the bridge.
    if (isTMA()) initTelegramApp();
    void waitForTelegramSdk(3000).then((ok) => {
      if (ok) initTelegramApp();
    });

    checkAuth();
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
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
      {/* Game — public, no auth required. Gated behind VITE_GAME_ON. */}
      {GAME_ON && <Route path="/game" element={<GamePage />} />}
      {GAME_ON && <Route path="/leaderboard" element={<GamePage />} />}

      {/* Tests are intentionally public — anonymous users can take them
          (results are kept in localStorage) and are nudged to sign in afterwards. */}
      <Route path="/tests" element={<TestsPage />} />
      <Route path="/tests/:testId" element={<TestRunnerPage />} />
      {/* Ad landing per test — the main paid entry point. Public, UTM-aware. */}
      <Route path="/test/:slug" element={<TestLandingPage />} />

      {/* Billing */}
      <Route path="/pricing" element={<Pricing />} />
      <Route
        path="/profile/subscription"
        element={
          <ProtectedRoute>
            <Subscription />
          </ProtectedRoute>
        }
      />

      {/* Legal — public, must be reachable without auth */}
      <Route path="/legal/offer" element={<Offer />} />
      <Route path="/legal/refund" element={<Refund />} />
      <Route path="/legal/privacy" element={<Privacy />} />
      <Route path="/legal/consent" element={<Consent />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

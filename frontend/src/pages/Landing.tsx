import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAuthStore } from "@/store/auth";
import { getInitData, getTelegramUser, isTMA, waitForTelegramSdk } from "@/utils/telegram";
import { useUtm } from "@/hooks/useUtm";
import Hero from "@/components/landing/Hero";
import StatsTicker from "@/components/landing/StatsTicker";
import Techniques from "@/components/landing/Techniques";
import UserGuide from "@/components/landing/UserGuide";
import AgentSystem from "@/components/landing/AgentSystem";
import InsightsFeed from "@/components/landing/InsightsFeed";
import TestsCTA from "@/components/landing/TestsCTA";
import Footer from "@/components/landing/Footer";
import { LandingGameBlock } from "@/components/game/LandingGameBlock";
import { GAME_ON } from "@/utils/features";

export default function Landing() {
  useUtm();
  const { isAuthenticated, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const telegramAuth = useAuthStore((s) => s.telegramAuth);
  const telegramMiniAppAuth = useAuthStore((s) => s.telegramMiniAppAuth);
  const navigate = useNavigate();

  useEffect(() => {
    if (window.location.hash === "#insights") {
      setTimeout(() => {
        document.getElementById("insights")?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, []);

  // Try Telegram auth using whatever signal we have: SDK initData → hash
  // initData → SDK initDataUnsafe.user → hash-parsed user. Returns the
  // auth response (with is_new_user) on success, null if no path worked.
  // Waits up to 3s for the WebApp SDK before falling back to OTP — on
  // some Android builds the SDK script is slow to attach.
  const tryTelegramAuth = async () => {
    if (!isTMA()) return null;
    await waitForTelegramSdk(3000);

    const initData = getInitData();
    if (initData) {
      try {
        return await telegramAuth(initData);
      } catch {
        // signature rejected or transient — try the user-only fallback below
      }
    }

    const tgUser = getTelegramUser();
    if (tgUser?.id) {
      try {
        return await telegramMiniAppAuth(String(tgUser.id), tgUser.first_name, tgUser.username);
      } catch {
        // fall through
      }
    }
    return null;
  };

  // Auto-attempt TMA auth on mount so the user is signed in by the time
  // they reach for a button. Skip when already authenticated or when there
  // is no Mini App context at all.
  const autoAuthAttempted = useRef(false);
  useEffect(() => {
    if (autoAuthAttempted.current) return;
    if (isAuthenticated) return;
    if (!isTMA()) return;
    autoAuthAttempted.current = true;
    void tryTelegramAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const handleStart = async () => {
    if (isTMA()) {
      setLoading(true);
      try {
        const data = await tryTelegramAuth();
        if (data) {
          navigate(data.is_new_user ? "/onboarding" : "/chat", { replace: true });
          return;
        }
      } finally {
        setLoading(false);
      }
    }
    navigate("/auth");
  };

  // Same auth logic as handleStart but stays on the landing page after login
  const handleLogin = async () => {
    if (isTMA()) {
      setLoginLoading(true);
      try {
        const data = await tryTelegramAuth();
        if (data) return;
      } finally {
        setLoginLoading(false);
      }
    }
    navigate("/auth?next=/");
  };

  return (
    <div className="min-h-screen">
      <nav className="fixed top-0 z-50 w-full border-b border-[#E8DDD0] bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="font-serif text-xl font-bold text-[#5A5048]">
            Ника
          </Link>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <>
                {user?.is_admin && (
                  <Link to="/admin" className="rounded-xl px-4 py-2 text-sm font-medium text-[#8A7A6A] transition-colors hover:bg-[#FAF6F1] hover:text-[#B8785A]">
                    Админ
                  </Link>
                )}
                <Link to="/chat" className="btn-primary">
                  Открыть чат
                </Link>
              </>
            ) : (
              <>
                <button
                  onClick={handleLogin}
                  disabled={loginLoading}
                  className="rounded-xl px-4 py-2 text-sm font-medium text-[#8A7A6A] transition-colors hover:bg-[#FAF6F1] hover:text-[#B8785A] inline-flex items-center gap-2"
                >
                  {loginLoading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#B8A898]/30 border-t-[#B8A898]" />
                  ) : (
                    "Войти"
                  )}
                </button>
                <button
                  onClick={handleStart}
                  disabled={loading}
                  className="btn-primary inline-flex items-center gap-2"
                >
                  {loading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    "Начать разговор"
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      <main>
        <Hero />
        <StatsTicker />
        <Techniques />
        <UserGuide />
        <TestsCTA />
        <AgentSystem />
        {GAME_ON && <LandingGameBlock />}
        <InsightsFeed />
      </main>
      <Footer />
    </div>
  );
}

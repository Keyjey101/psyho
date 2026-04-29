import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAuthStore } from "@/store/auth";
import { getInitData, getTelegramUser } from "@/utils/telegram";
import Hero from "@/components/landing/Hero";
import Techniques from "@/components/landing/Techniques";
import UserGuide from "@/components/landing/UserGuide";
import AgentSystem from "@/components/landing/AgentSystem";
import InsightsFeed from "@/components/landing/InsightsFeed";

export default function Landing() {
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

  const handleStart = async () => {
    const initData = getInitData();
    if (initData) {
      setLoading(true);
      try {
        const data = await telegramAuth(initData);
        navigate(data.is_new_user ? "/onboarding" : "/chat", { replace: true });
        return;
      } catch {
        // fall through to initDataUnsafe fallback
      } finally {
        setLoading(false);
      }
    }

    const tgUser = getTelegramUser();
    if (tgUser?.id) {
      setLoading(true);
      try {
        const data = await telegramMiniAppAuth(String(tgUser.id), tgUser.first_name, tgUser.username);
        navigate(data.is_new_user ? "/onboarding" : "/chat", { replace: true });
        return;
      } catch {
        // fall through to OTP
      } finally {
        setLoading(false);
      }
    }

    navigate("/auth");
  };

  // Same auth logic as handleStart but stays on the landing page after login
  const handleLogin = async () => {
    const initData = getInitData();
    if (initData) {
      setLoginLoading(true);
      try {
        await telegramAuth(initData);
        return;
      } catch {
        // fall through to initDataUnsafe fallback
      } finally {
        setLoginLoading(false);
      }
    }

    const tgUser = getTelegramUser();
    if (tgUser?.id) {
      setLoginLoading(true);
      try {
        await telegramMiniAppAuth(String(tgUser.id), tgUser.first_name, tgUser.username);
        return;
      } catch {
        // fall through to OTP
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
        <Techniques />
        <UserGuide />
        <AgentSystem />
        <InsightsFeed />
      </main>
    </div>
  );
}

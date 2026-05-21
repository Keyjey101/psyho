import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/auth";
import { getInitData, getTelegramUser } from "@/utils/telegram";

const TRUST_BADGES = [
  { icon: "🔒", label: "Переписка приватна" },
  { icon: "🧬", label: "Доказательные методы" },
  { icon: "🤍", label: "Без осуждения" },
];

export default function Hero() {
  const [loading, setLoading] = useState(false);
  const telegramAuth = useAuthStore((s) => s.telegramAuth);
  const telegramMiniAppAuth = useAuthStore((s) => s.telegramMiniAppAuth);
  const navigate = useNavigate();

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
        const data = await telegramMiniAppAuth(
          String(tgUser.id),
          tgUser.first_name,
          tgUser.username
        );
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

  return (
    <section className="relative flex min-h-[90vh] items-center justify-center overflow-hidden px-6 pt-20 sm:min-h-screen">
      {/* Background gradient */}
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(to bottom, #FAF6F1, #F3EBE3)" }}
      />

      {/* Grain texture */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Ambient orbs — очень тихие, почти не видно */}
      <motion.div
        className="pointer-events-none absolute right-1/4 top-1/3 h-80 w-80 rounded-full"
        style={{
          background: "#EBB090",
          filter: "blur(90px)",
          opacity: 0.09,
        }}
        animate={{ y: [-18, 18], x: [-10, 10] }}
        transition={{
          duration: 11,
          repeat: Infinity,
          repeatType: "mirror",
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="pointer-events-none absolute bottom-1/3 left-1/4 h-56 w-56 rounded-full"
        style={{
          background: "#D4A574",
          filter: "blur(70px)",
          opacity: 0.07,
        }}
        animate={{ y: [22, -22], x: [14, -14] }}
        transition={{
          duration: 15,
          repeat: Infinity,
          repeatType: "mirror",
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="pointer-events-none absolute bottom-1/4 right-1/3 h-64 w-64 rounded-full"
        style={{
          background: "#CF7250",
          filter: "blur(100px)",
          opacity: 0.06,
        }}
        animate={{ y: [-28, 28] }}
        transition={{
          duration: 19,
          repeat: Infinity,
          repeatType: "mirror",
          ease: "easeInOut",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative z-10 mx-auto max-w-[480px] text-center"
      >
        <div className="mx-auto mb-8 flex h-[200px] w-[200px] items-center justify-center sm:h-[280px] sm:w-[280px]">
          <img
            src="/illustrations/opt/landing_hero.webp"
            alt=""
            className="h-full w-full object-contain"
            onError={(e) => {
              e.currentTarget.src = "/illustrations/landing_hero.png";
            }}
          />
        </div>

        <h1 className="font-serif text-2xl font-bold text-[#4A4038] sm:text-[28px]">
          Поговорим?
        </h1>

        <p className="mx-auto mt-4 max-w-sm text-[15px] leading-[1.6] text-[#8A7A6A]">
          Безопасное пространство, где тебя выслушают и поймут
        </p>

        <div className="mt-8 flex flex-col items-center gap-3">
          <button
            onClick={handleStart}
            disabled={loading}
            className="btn-primary inline-flex w-full max-w-[320px] items-center justify-center gap-2"
          >
            {loading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              "Начать разговор"
            )}
          </button>

          {/* Online indicator */}
          <div className="flex items-center gap-1.5">
            <motion.span
              className="h-1.5 w-1.5 rounded-full bg-emerald-400"
              animate={{ opacity: [1, 0.25, 1] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            />
            <span className="text-[11px] text-[#B8A898]">
              Ника сейчас онлайн
            </span>
          </div>
        </div>

        {/* Trust badges */}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {TRUST_BADGES.map((b) => (
            <span
              key={b.label}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#E8DDD0] bg-white/60 px-3 py-1 text-[11px] text-[#8A7A6A] backdrop-blur-sm"
            >
              <span className="text-[10px]">{b.icon}</span>
              {b.label}
            </span>
          ))}
        </div>

        <p className="mt-5 text-xs text-[#B8A898]">
          Бесплатно · Без карты · Без обязательств
        </p>
      </motion.div>
    </section>
  );
}

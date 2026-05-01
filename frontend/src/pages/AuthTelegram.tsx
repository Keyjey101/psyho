import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Send, RefreshCw, Copy, Check } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { isTMA, getInitData, getTelegramUser } from "@/utils/telegram";

type Step = "tma_loading" | "input" | "code";

export default function AuthTelegram() {
  const [step, setStep] = useState<Step>(isTMA() ? "tma_loading" : "input");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [code, setCode] = useState("");
  const [requestId, setRequestId] = useState("");
  const [botUsername, setBotUsername] = useState("");
  const [expiresIn, setExpiresIn] = useState(0);
  const [polling, setPolling] = useState(false);
  const [expired, setExpired] = useState(false);
  const [copied, setCopied] = useState(false);
  const [autoCopiedNotice, setAutoCopiedNotice] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { requestTgCode, checkTgCode, telegramAuth, telegramMiniAppAuth } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nextPath = searchParams.get("next") || null;

  // В Telegram Mini App — авторизуемся автоматически, OTP не нужен
  useEffect(() => {
    if (!isTMA()) return;
    const initData = getInitData();
    if (initData) {
      telegramAuth(initData)
        .then((data) => {
          navigate(data.is_new_user ? "/onboarding" : (nextPath || "/chat"), { replace: true });
        })
        .catch(() => { setStep("input"); });
      return;
    }
    // Fallback for Telegram Android where initData is empty but initDataUnsafe.user is available
    const tgUser = getTelegramUser();
    if (tgUser?.id) {
      telegramMiniAppAuth(String(tgUser.id), tgUser.first_name, tgUser.username)
        .then((data) => {
          navigate(data.is_new_user ? "/onboarding" : (nextPath || "/chat"), { replace: true });
        })
        .catch(() => { setStep("input"); });
      return;
    }
    setStep("input");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setPolling(false);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopPolling();
      stopTimer();
    };
  }, [stopPolling, stopTimer]);

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await requestTgCode(username.trim());
      setCode(data.code);
      setRequestId(data.request_id);
      setBotUsername(data.bot_username);
      setExpiresIn(data.expires_in);
      setExpired(false);
      setStep("code");
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(detail || "Не удалось получить код. Попробуй позже.");
    } finally {
      setLoading(false);
    }
  };

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    setPolling(true);
    pollRef.current = setInterval(async () => {
      try {
        const data = await checkTgCode(requestId);
        if (data.status === "verified") {
          stopPolling();
          stopTimer();
          navigate(data.is_new_user ? "/onboarding" : (nextPath || "/chat"), { replace: true });
        } else if (data.status === "expired") {
          stopPolling();
          stopTimer();
          setExpired(true);
        }
      } catch {
        // continue polling
      }
    }, 2000);
  }, [requestId, checkTgCode, navigate, stopPolling, stopTimer]);

  // Auto-copy the code as soon as user lands on the code step
  useEffect(() => {
    if (step !== "code" || !code) return;
    if (!navigator.clipboard?.writeText) return;
    navigator.clipboard.writeText(code).then(
      () => {
        setAutoCopiedNotice(true);
        setTimeout(() => setAutoCopiedNotice(false), 4000);
      },
      () => {
        // clipboard blocked (e.g. permission) — silently ignore
      },
    );
  }, [step, code]);

  useEffect(() => {
    if (step === "code" && requestId && !expired) {
      const countdown = expiresIn;
      let remaining = countdown;
      timerRef.current = setInterval(() => {
        remaining -= 1;
        setExpiresIn(remaining);
        if (remaining <= 0) {
          stopTimer();
          setExpired(true);
          stopPolling();
        }
      }, 1000);

      startPolling();

      return () => {
        stopTimer();
        stopPolling();
      };
    }
  }, [step, requestId, expired, startPolling, stopTimer, stopPolling]);

  const handleNewCode = () => {
    stopPolling();
    stopTimer();
    setStep("input");
    setCode("");
    setRequestId("");
    setExpired(false);
    setError("");
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const botLink = botUsername ? `https://t.me/${botUsername}` : "#";

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#FAF6F1] px-6">
      <div
        className="w-full max-w-sm rounded-[24px] bg-white p-10"
        style={{ boxShadow: "0 4px 24px rgba(90,80,72,0.08)" }}
      >
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center">
          <img
            src="/illustrations/opt/ai_avatar.webp"
            alt=""
            className="h-full w-full object-contain"
            onError={(e) => { e.currentTarget.src = "/illustrations/ai_avatar.png" }}
          />
        </div>

        {step === "tma_loading" && (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E8DDD0] border-t-[#B8785A]" />
            <p className="text-[13px] text-[#8A7A6A]">Входим через Telegram...</p>
          </div>
        )}

        {step === "input" && (
          <>
            <h1 className="mb-1 text-center font-serif text-[24px] font-bold text-[#4A4038]">
              Поговорим?
            </h1>
            <p className="mb-8 text-center text-[13px] text-[#8A7A6A]">
              Войди через Telegram
            </p>

            {error && (
              <div className="mb-4 rounded-[14px] border border-[#C4786A] bg-[#FDF5F3] px-4 py-3 text-sm text-[#C4786A]">
                {error}
              </div>
            )}

            <form onSubmit={handleRequestCode} className="space-y-4">
              <div className="relative">
                <Send className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#B8A898]" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input-field pl-10"
                  placeholder="@username (необязательно)"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                className="btn-primary w-full"
                disabled={loading}
              >
                {loading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  "Получить код"
                )}
              </button>
            </form>

          </>
        )}

        {step === "code" && (
          <>
            <button
              onClick={handleNewCode}
              className="mb-6 flex items-center gap-1.5 text-sm text-[#8A7A6A] hover:text-[#5A5048]"
            >
              <ArrowLeft className="h-4 w-4" />
              Назад
            </button>

            <h1 className="mb-1 text-center font-serif text-[22px] font-bold text-[#4A4038]">
              Твой код
            </h1>
            <p className="mb-3 text-center text-[13px] text-[#8A7A6A]">
              Отправь этот код боту — и вход выполнится автоматически
            </p>

            {autoCopiedNotice && (
              <div className="mx-auto mb-4 flex max-w-[260px] items-center justify-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[11.5px] font-medium text-emerald-700">
                <Check className="h-3.5 w-3.5" />
                Код скопирован — открывай бот и вставляй
              </div>
            )}

            <div className="mb-2 flex justify-center gap-2.5">
              {code.split("").map((digit, i) => (
                <div
                  key={i}
                  className="flex h-14 w-11 items-center justify-center rounded-[14px] border border-[#B8785A] bg-[#FAF6F1] text-xl font-bold tabular-nums text-[#4A4038] font-mono"
                >
                  {digit}
                </div>
              ))}
            </div>

            <div className="mb-4 flex justify-center">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(code).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  });
                }}
                className="flex items-center gap-1.5 text-[12px] text-[#B8A898] hover:text-[#8A7A6A] transition-colors"
              >
                {copied ? (
                  <><Check className="h-3.5 w-3.5 text-green-500" /><span className="text-green-500">Скопировано</span></>
                ) : (
                  <><Copy className="h-3.5 w-3.5" />Скопировать код</>
                )}
              </button>
            </div>

            {expired ? (
              <div className="text-center">
                <p className="mb-3 text-[13px] text-[#C4786A]">
                  Код истёк
                </p>
                <button
                  onClick={handleNewCode}
                  className="flex items-center gap-1.5 mx-auto text-[13px] text-[#B8785A] hover:text-[#9E6349]"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Получить новый код
                </button>
              </div>
            ) : (
              <>
                <a
                  href={botLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary block text-center w-full no-underline"
                >
                  Написать боту {botUsername ? `@${botUsername}` : ""}
                </a>

                <p className="mt-4 text-center text-[12px] text-[#B8A898]">
                  Код действителен {formatTime(expiresIn)}
                </p>

                {polling && (
                  <div className="mt-3 flex justify-center">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#E8DDD0] border-t-[#B8785A]" />
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

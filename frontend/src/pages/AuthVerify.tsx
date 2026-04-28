import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useAuthStore } from "@/store/auth";

const CODE_LENGTH = 6;
const RESEND_COOLDOWN = 60;

export default function AuthVerify() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") || "";
  const navigate = useNavigate();
  const { sendCode, verifyCode } = useAuthStore();

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleDigitChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    setError("");

    if (digit && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (pasted.length > 0) {
      const next = Array(CODE_LENGTH).fill("");
      pasted.split("").forEach((d, i) => { next[i] = d; });
      setDigits(next);
      const focusIdx = Math.min(pasted.length, CODE_LENGTH - 1);
      inputRefs.current[focusIdx]?.focus();
    }
  };

  const code = digits.join("");
  const isComplete = code.length === CODE_LENGTH;

  const handleSubmit = useCallback(async () => {
    if (!isComplete || loading) return;
    setLoading(true);
    setError("");
    try {
      const { is_new_user } = await verifyCode(email, code);
      navigate(is_new_user ? "/onboarding" : "/chat", { replace: true });
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(detail || "Неверный или просроченный код.");
      setDigits(Array(CODE_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }, [isComplete, loading, verifyCode, email, code, navigate]);

  useEffect(() => {
    if (isComplete) handleSubmit();
  }, [isComplete, handleSubmit]);

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      await sendCode(email);
      setResendCooldown(RESEND_COOLDOWN);
      setDigits(Array(CODE_LENGTH).fill(""));
      setError("");
      inputRefs.current[0]?.focus();
    } catch {
      setError("Не удалось отправить код. Попробуй позже.");
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#FAF6F1] px-6">
      <div
        className="w-full max-w-sm rounded-[24px] bg-white p-10"
        style={{ boxShadow: "0 4px 24px rgba(90,80,72,0.08)" }}
      >
        <button
          onClick={() => navigate("/auth/email")}
          className="mb-6 flex items-center gap-1.5 text-sm text-[#8A7A6A] hover:text-[#5A5048]"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад
        </button>

        <h1 className="mb-1 text-center font-serif text-[22px] font-bold text-[#4A4038]">
          Введи код
        </h1>
        <p className="mb-2 text-center text-[13px] text-[#8A7A6A]">
          Отправили 6-значный код на
        </p>
        <p className="mb-8 text-center text-[13px] font-medium text-[#B8785A]">
          {email}
        </p>

        {error && (
          <div className="mb-4 rounded-[14px] border border-[#C4786A] bg-[#FDF5F3] px-4 py-3 text-sm text-[#C4786A]">
            {error}
          </div>
        )}

        <div className="mb-6 flex justify-center gap-2" onPaste={handlePaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => handleDigitChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className={`h-12 w-10 rounded-[12px] border text-center text-lg font-semibold text-[#4A4038] outline-none transition-all ${
                d
                  ? "border-[#B8785A] bg-[#FAF6F1]"
                  : "border-[#D8CDC0] bg-white focus:border-[#B8785A]"
              }`}
            />
          ))}
        </div>

        {loading && (
          <div className="mb-4 flex justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#E8DDD0] border-t-[#B8785A]" />
          </div>
        )}

        <div className="text-center">
          {resendCooldown > 0 ? (
            <p className="text-[13px] text-[#B8A898]">
              Отправить повторно через {resendCooldown} с
            </p>
          ) : (
            <button
              onClick={handleResend}
              className="flex items-center gap-1.5 mx-auto text-[13px] text-[#B8785A] hover:text-[#9E6349]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Отправить код ещё раз
            </button>
          )}
        </div>

        <p className="mt-6 text-center text-[11px] text-[#B8A898]">
          Код действителен 10 минут
        </p>
      </div>
    </div>
  );
}

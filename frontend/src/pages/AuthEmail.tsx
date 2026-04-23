import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail } from "lucide-react";
import { useAuthStore } from "@/store/auth";

export default function AuthEmail() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { sendCode } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await sendCode(email.trim().toLowerCase());
      navigate(`/auth/verify?email=${encodeURIComponent(email.trim().toLowerCase())}`);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (detail?.includes("Слишком много")) {
        setError(detail);
      } else {
        setError("Не удалось отправить код. Проверь адрес или попробуй позже.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#FAF6F1] px-6">
      <div
        className="w-full max-w-sm rounded-[24px] bg-white p-10"
        style={{ boxShadow: "0 4px 24px rgba(90,80,72,0.08)" }}
      >
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center">
          <img
            src="/illustrations/ai_avatar.png"
            alt=""
            className="h-full w-full object-contain"
          />
        </div>

        <h1 className="mb-1 text-center font-serif text-[24px] font-bold text-[#4A4038]">
          Поговорим?
        </h1>
        <p className="mb-8 text-center text-[13px] text-[#8A7A6A]">
          Введи свой email — отправим код для входа
        </p>

        {error && (
          <div className="mb-4 rounded-[14px] border border-[#C4786A] bg-[#FDF5F3] px-4 py-3 text-sm text-[#C4786A]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#B8A898]" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field pl-10"
              placeholder="example@mail.ru"
              autoFocus
              required
            />
          </div>

          <button
            type="submit"
            className="btn-primary w-full"
            disabled={loading || !email.trim()}
          >
            {loading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              "Продолжить"
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-[12px] text-[#B8A898]">
          Нет пароля — только код на почту. Безопасно и просто.
        </p>
      </div>
    </div>
  );
}

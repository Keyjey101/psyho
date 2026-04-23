import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { Helmet } from "react-helmet-async";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/chat");
    } catch {
      setError("Пароль не подошёл, попробуем ещё раз?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAF6F1] px-6">
      <Helmet>
        <title>Вход — Ника</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="w-full max-w-sm rounded-[20px] bg-white p-10" style={{ boxShadow: "0 4px 24px rgba(90,80,72,0.08)" }}>
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center">
          <img
            src="/illustrations/opt/auth_login.webp"
            alt=""
            className="h-full w-full object-contain"
          />
        </div>

        <h2 className="mb-1 text-center font-serif text-[22px] font-bold text-[#4A4038]">
          Войти тихо
        </h2>
        <p className="mb-8 text-center text-[13px] text-[#8A7A6A]">
          Рада тебя видеть снова
        </p>

        {error && (
          <div className="mb-4 rounded-[14px] border border-[#C4786A] bg-[#FDF5F3] px-4 py-3 text-sm text-[#C4786A]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#B8A898]" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field pl-10"
                placeholder="Твой email"
                required
              />
            </div>
          </div>

          <div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#B8A898]" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field pl-10 pr-10"
                placeholder="Пароль"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#B8A898] hover:text-[#8A7A6A]"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              "Войти"
            )}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-[#8A7A6A]">
          <span className="cursor-pointer hover:text-[#B8785A]">Забыла пароль?</span>
        </p>

        <p className="mt-6 text-center text-sm text-[#8A7A6A]">
          Нет аккаунта?{" "}
          <Link to="/register" className="font-semibold text-[#B8785A] hover:text-[#9E6349]">
            Создать
          </Link>
        </p>
      </div>
    </div>
  );
}

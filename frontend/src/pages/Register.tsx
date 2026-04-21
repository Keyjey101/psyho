import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Mail, Lock, User, Eye, EyeOff } from "lucide-react";
import { Helmet } from "react-helmet-async";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Пароль должен быть не менее 8 символов и содержать хотя бы одну цифру");
      return;
    }
    if (!/\d/.test(password)) {
      setError("Пароль должен содержать хотя бы одну цифру");
      return;
    }
    setLoading(true);
    try {
      await register(email, password, name);
      navigate("/onboarding");
    } catch {
      setError("Ошибка регистрации. Возможно, email уже занят");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <Helmet>
        <title>Регистрация — PsyHo</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="hidden flex-1 items-center justify-center bg-gradient-to-br from-warm-500 via-warm-600 to-warm-800 lg:flex">
        <div className="max-w-md px-12 text-white">
          <div className="mb-8 text-6xl font-bold">
            Начни<span className="text-warm-200"> путь</span>
          </div>
          <p className="mb-6 text-xl leading-relaxed text-warm-100">
            Регистрация занимает 30 секунд. Ты получишь доступ к ИИ-терапевту, который подберёт подход именно для тебя.
          </p>
          <div className="space-y-3 text-warm-200">
            <p>✓ Бесплатно</p>
            <p>✓ Без обязательств</p>
            <p>✓ Полная конфиденциальность</p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <Link to="/" className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-lg text-white shadow-md">
              P
            </div>
            <span className="text-xl font-bold text-surface-900">
              Psy<span className="text-primary-600">Ho</span>
            </span>
          </Link>

          <h1 className="mb-2 text-2xl font-bold text-surface-900">
            Создать аккаунт
          </h1>
          <p className="mb-8 text-surface-500">
            Начни свой путь к пониманию себя
          </p>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-700">
                Имя
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-field pl-10"
                  placeholder="Как тебя зовут?"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-700">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field pl-10"
                  placeholder="your@email.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-700">
                Пароль
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pl-10 pr-10"
                  placeholder="Минимум 8 символов, 1 цифра"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                "Создать аккаунт"
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-surface-500">
            Уже есть аккаунт?{" "}
            <Link to="/login" className="font-semibold text-primary-600 hover:text-primary-700">
              Войти
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

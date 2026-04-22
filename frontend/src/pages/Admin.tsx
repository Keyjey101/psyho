import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/api/client";
import { Users, MessageSquare, BarChart3, ShieldOff, AlertCircle } from "lucide-react";
import { Helmet } from "react-helmet-async";

interface AdminStats {
  users: number;
  sessions: number;
  messages: number;
}

interface AdminUser {
  id: string;
  email: string;
  name: string;
  created_at: string;
  is_active: boolean;
}

export default function Admin() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/admin/stats").then(({ data }) => {
      setStats(data);
    }).catch((err) => {
      if (err.response?.status === 403) {
        navigate("/");
      } else {
        setError("Не удалось загрузить статистику");
      }
    });

    api.get("/admin/users").then(({ data }) => {
      setUsers(data);
    }).catch(() => {});
  }, [navigate]);

  const handleDeactivate = async (userId: string) => {
    try {
      await api.patch(`/admin/users/${userId}/deactivate`);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_active: false } : u))
      );
    } catch {
      setError("Ошибка деактивации");
    }
  };

  if (error && !stats) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
          <p className="text-surface-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-50 p-6 lg:p-10">
      <Helmet>
        <title>Админ-панель — Ника</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-8 text-2xl font-bold text-surface-900">Админ-панель</h1>

        {stats && (
          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-surface-100 bg-white p-6 shadow-sm">
              <div className="mb-2 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100">
                  <Users className="h-5 w-5 text-primary-600" />
                </div>
                <span className="text-sm font-medium text-surface-500">Пользователи</span>
              </div>
              <p className="text-3xl font-bold text-surface-900">{stats.users}</p>
            </div>
            <div className="rounded-2xl border border-surface-100 bg-white p-6 shadow-sm">
              <div className="mb-2 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
                  <MessageSquare className="h-5 w-5 text-emerald-600" />
                </div>
                <span className="text-sm font-medium text-surface-500">Сессии</span>
              </div>
              <p className="text-3xl font-bold text-surface-900">{stats.sessions}</p>
            </div>
            <div className="rounded-2xl border border-surface-100 bg-white p-6 shadow-sm">
              <div className="mb-2 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
                  <BarChart3 className="h-5 w-5 text-amber-600" />
                </div>
                <span className="text-sm font-medium text-surface-500">Сообщения</span>
              </div>
              <p className="text-3xl font-bold text-surface-900">{stats.messages}</p>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-surface-100 bg-white shadow-sm">
          <div className="border-b border-surface-100 px-6 py-4">
            <h2 className="text-lg font-semibold text-surface-900">Пользователи</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-100 text-left text-xs font-medium uppercase tracking-wider text-surface-500">
                  <th className="px-6 py-3">Имя</th>
                  <th className="px-6 py-3">Email</th>
                  <th className="px-6 py-3">Дата регистрации</th>
                  <th className="px-6 py-3">Статус</th>
                  <th className="px-6 py-3">Действие</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {users.map((user) => (
                  <tr key={user.id} className="text-sm">
                    <td className="px-6 py-4 font-medium text-surface-900">{user.name}</td>
                    <td className="px-6 py-4 text-surface-600">{user.email}</td>
                    <td className="px-6 py-4 text-surface-500">
                      {new Date(user.created_at).toLocaleDateString("ru-RU")}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          user.is_active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        {user.is_active ? "Активен" : "Деактивирован"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {user.is_active && (
                        <button
                          onClick={() => handleDeactivate(user.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                        >
                          <ShieldOff className="h-3.5 w-3.5" />
                          Деактивировать
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

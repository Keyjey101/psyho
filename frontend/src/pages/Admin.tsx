import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/api/client";
import {
  Users,
  MessageSquare,
  BarChart3,
  ShieldOff,
  AlertCircle,
  Activity,
  TrendingUp,
  Smile,
} from "lucide-react";
import { Helmet } from "react-helmet-async";
import { AGENTS } from "@/types";

interface AdminStats {
  users: number;
  sessions: number;
  messages: number;
}

interface ExtendedStats {
  users_total: number;
  users_last_7d: number;
  users_last_30d: number;
  sessions_last_7d: number;
  sessions_last_30d: number;
  avg_session_length_exchanges: number;
  avg_mood_last_30d: number | null;
  agent_usage: Record<string, number>;
  top_topics: { topic: string; count: number }[];
  daily_sessions: { date: string; count: number }[];
}

interface AdminUser {
  id: string;
  email: string;
  name: string;
  created_at: string;
  is_active: boolean;
}

function MiniSparkline({ data }: { data: { date: string; count: number }[] }) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.count), 1);
  const w = 300;
  const h = 60;
  const step = w / Math.max(data.length - 1, 1);
  const points = data.map((d, i) => `${i * step},${h - (d.count / max) * h}`).join(" ");
  const areaPoints = `0,${h} ${points} ${w},${h}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none">
      <polygon points={areaPoints} fill="#B8785A" fillOpacity={0.15} />
      <polyline points={points} fill="none" stroke="#B8785A" strokeWidth={2} />
    </svg>
  );
}

export default function Admin() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [extended, setExtended] = useState<ExtendedStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    api
      .get("/admin/stats")
      .then(({ data }) => setStats(data))
      .catch((err) => {
        if (err.response?.status === 403) {
          navigate("/");
        } else {
          setError("Не удалось загрузить статистику");
        }
      });

    api
      .get("/admin/stats/extended")
      .then(({ data }) => setExtended(data))
      .catch(() => {});

    api.get("/admin/users").then(({ data }) => setUsers(data)).catch(() => {});
  }, [navigate]);

  const handleDeactivate = async (userId: string) => {
    try {
      await api.patch(`/admin/users/${userId}/deactivate`);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, is_active: false } : u)));
    } catch {
      setError("Ошибка деактивации");
    }
  };

  const moodEmoji = (val: number) => {
    if (val <= 1.5) return "😫";
    if (val <= 2.5) return "😟";
    if (val <= 3.5) return "😐";
    if (val <= 4.5) return "🙂";
    return "😊";
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

        {extended && (
          <div className="mb-8 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-surface-100 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <Activity className="h-5 w-5 text-primary-600" />
                <h2 className="text-lg font-semibold text-surface-900">Сессии за 30 дней</h2>
              </div>
              <MiniSparkline data={extended.daily_sessions} />
              <div className="mt-3 flex gap-4 text-sm text-surface-500">
                <span>7д: {extended.sessions_last_7d}</span>
                <span>30д: {extended.sessions_last_30d}</span>
              </div>
            </div>

            <div className="rounded-2xl border border-surface-100 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-primary-600" />
                <h2 className="text-lg font-semibold text-surface-900">Обзор</h2>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-surface-500">Новые пользователи (7д / 30д)</span>
                  <span className="text-sm font-semibold text-surface-800">
                    {extended.users_last_7d} / {extended.users_last_30d}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-surface-500">Средняя длина сессии</span>
                  <span className="text-sm font-semibold text-surface-800">
                    {extended.avg_session_length_exchanges} обменов
                  </span>
                </div>
                {extended.avg_mood_last_30d !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-surface-500">Среднее настроение (30д)</span>
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-surface-800">
                      <Smile className="h-4 w-4" />
                      {moodEmoji(extended.avg_mood_last_30d)} {extended.avg_mood_last_30d}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-surface-100 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-surface-900">Использование агентов</h2>
              <div className="space-y-2">
                {Object.entries(extended.agent_usage)
                  .sort(([, a], [, b]) => b - a)
                  .map(([agentId, count]) => {
                    const agentInfo = AGENTS.find((a) => a.id === agentId);
                    const maxCount = Math.max(...Object.values(extended.agent_usage), 1);
                    return (
                      <div key={agentId} className="flex items-center gap-2">
                        <span className="w-20 shrink-0 text-xs text-surface-600">
                          {agentInfo?.name || agentId}
                        </span>
                        <div className="flex-1">
                          <div className="h-4 overflow-hidden rounded bg-surface-100">
                            <div
                              className="h-full rounded bg-primary-600"
                              style={{ width: `${(count / maxCount) * 100}%` }}
                            />
                          </div>
                        </div>
                        <span className="w-10 text-right text-xs font-medium text-surface-500">
                          {count}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="rounded-2xl border border-surface-100 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-surface-900">Топ темы</h2>
              <div className="space-y-2">
                {extended.top_topics.slice(0, 8).map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="inline-flex rounded-full bg-surface-100 px-2.5 py-0.5 text-xs font-medium text-surface-700">
                      {item.topic}
                    </span>
                    <span className="text-xs text-surface-500">{item.count}</span>
                  </div>
                ))}
                {extended.top_topics.length === 0 && (
                  <p className="text-sm text-surface-400">Нет данных</p>
                )}
              </div>
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

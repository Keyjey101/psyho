import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/api/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Users,
  MessageSquare,
  BarChart3,
  ShieldOff,
  AlertCircle,
  Activity,
  TrendingUp,
  Smile,
  DollarSign,
  Zap,
  RefreshCw,
  Download,
  Search,
  ChevronDown,
  ChevronUp,
  Eye,
  CheckCircle,
  XCircle,
  Settings,
  ArrowUpDown,
  UserCheck,
  UserX,
  Clock,
  Target,
  Heart,
} from "lucide-react";
import { Helmet } from "react-helmet-async";
import { AGENTS } from "@/types";

interface AdminStats {
  users: number;
  sessions: number;
  messages: number;
  total_tokens: number;
  estimated_cost: number;
}

interface ExtendedStats {
  users_total: number;
  users_last_7d: number;
  users_last_30d: number;
  sessions_last_7d: number;
  sessions_last_30d: number;
  sessions_today: number;
  avg_session_length_exchanges: number;
  avg_mood_last_30d: number | null;
  agent_usage: Record<string, number>;
  top_topics: { topic: string; count: number }[];
  daily_sessions: { date: string; count: number }[];
  daily_messages: { date: string; count: number }[];
  daily_tokens: { date: string; tokens: number }[];
  daily_mood: { date: string; avg_mood: number | null; count: number }[];
  tokens_total: number;
  tokens_last_7d: number;
  tokens_last_30d: number;
  tokens_today: number;
  token_price: number;
  cost_total: number;
  cost_last_7d: number;
  cost_last_30d: number;
  cost_today: number;
  dau: number;
  wau: number;
  mau: number;
  retention_7d: number;
  retention_30d: number;
  sessions_completed_pct: number;
  users_with_session: number;
  users_returned: number;
  activation_rate: number;
}

interface AdminUser {
  id: string;
  email: string;
  name: string;
  created_at: string;
  is_active: boolean;
  sessions_count: number;
  messages_count: number;
  tokens_total: number;
  cost_total: number;
  last_active_at: string | null;
  avg_mood: number | null;
}

interface UserDetail {
  id: string;
  email: string;
  name: string;
  created_at: string;
  is_active: boolean;
  total_sessions: number;
  total_messages: number;
  total_tokens: number;
  total_cost: number;
  avg_mood: number | null;
  diary_entries_count: number;
  tasks_count: number;
  tasks_completed: number;
  achievements: { achievement_type: string; earned_at: string }[];
  sessions: {
    id: string;
    title: string | null;
    created_at: string;
    updated_at: string;
    message_count: number;
    tokens: number;
    cost: number;
  }[];
}

interface AdminInsight {
  id: string;
  content: string;
  reactions: number;
  created_at: string;
  is_approved: boolean;
}

type TabType = "dashboard" | "users" | "content" | "settings";

function MiniChart({ data, dataKey, color = "#B8785A", height = 60 }: { data: { date: string; [k: string]: any }[]; dataKey: string; color?: string; height?: number }) {
  if (data.length === 0) return <p className="text-sm text-surface-400">Нет данных</p>;
  const values = data.map((d) => Number(d[dataKey]) || 0);
  const max = Math.max(...values, 1);
  const w = 300;
  const h = height;
  const step = w / Math.max(data.length - 1, 1);
  const points = values.map((v, i) => `${i * step},${h - (v / max) * h}`).join(" ");
  const areaPoints = `0,${h} ${points} ${w},${h}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none">
      <polygon points={areaPoints} fill={color} fillOpacity={0.12} />
      <polyline points={points} fill="none" stroke={color} strokeWidth={2} />
    </svg>
  );
}

function StatCard({ icon: Icon, label, value, sub, iconBg, iconColor }: { icon: any; label: string; value: string | number; sub?: string; iconBg: string; iconColor: string }) {
  return (
    <div className="rounded-2xl border border-surface-100 bg-white p-5 shadow-sm">
      <div className="mb-2 flex items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconBg}`}>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>
        <span className="text-xs font-medium text-surface-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-surface-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-surface-400">{sub}</p>}
    </div>
  );
}

export default function Admin() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [extended, setExtended] = useState<ExtendedStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [insights, setInsights] = useState<{ total: number; pending_count: number; insights: AdminInsight[] } | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [tab, setTab] = useState<TabType>("dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<boolean | null>(null);
  const [sortField, setSortField] = useState<string>("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [tokenPrice, setTokenPrice] = useState("0");
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user && !user.is_admin) {
      navigate("/", { replace: true });
    }
  }, [user, navigate]);

  const loadData = useCallback(async () => {
    setRefreshing(true);
    try {
      const [statsRes, extRes, usersRes] = await Promise.all([
        api.get("/admin/stats"),
        api.get("/admin/stats/extended"),
        api.get("/admin/users", { params: { search: searchQuery || undefined, active_only: activeFilter ?? undefined, sort: sortField, order: sortOrder, limit: 100 } }),
      ]);
      setStats(statsRes.data);
      setExtended(extRes.data);
      setUsers(usersRes.data);
    } catch (err: any) {
      if (err.response?.status === 403) {
        navigate("/");
      } else {
        setError("Не удалось загрузить статистику");
      }
    } finally {
      setRefreshing(false);
    }
  }, [navigate, searchQuery, activeFilter, sortField, sortOrder]);

  const loadInsights = useCallback(async () => {
    try {
      const { data } = await api.get("/admin/insights", { params: { limit: 50 } });
      setInsights(data);
    } catch {}
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const { data } = await api.get("/admin/settings");
      setSettings(data);
      setTokenPrice(data.token_price || "0");
    } catch {}
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (tab === "content") loadInsights();
    if (tab === "settings") loadSettings();
  }, [tab, loadInsights, loadSettings]);

  const handleToggleStatus = async (userId: string) => {
    try {
      const { data } = await api.patch(`/admin/users/${userId}/status`);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, is_active: data.is_active } : u)));
    } catch {
      setError("Ошибка смены статуса");
    }
  };

  const handleToggleInsight = async (insightId: string) => {
    try {
      await api.patch(`/admin/insights/${insightId}/toggle`);
      loadInsights();
    } catch {
      setError("Ошибка смены статуса инсайта");
    }
  };

  const handleOpenUser = async (userId: string) => {
    try {
      const { data } = await api.get(`/admin/users/${userId}`);
      setSelectedUser(data);
      setShowUserModal(true);
    } catch {
      setError("Не удалось загрузить данные пользователя");
    }
  };

  const handleSaveSettings = async () => {
    try {
      await api.put("/admin/settings", {
        settings: [{ key: "token_price", value: tokenPrice }],
      });
      loadData();
    } catch {
      setError("Ошибка сохранения настроек");
    }
  };

  const handleExport = () => {
    window.open(`${import.meta.env.VITE_API_URL || "/api"}/admin/export/users`, "_blank");
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return null;
    return sortOrder === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  };

  const moodEmoji = (val: number) => {
    if (val <= 1.5) return "😫";
    if (val <= 2.5) return "😟";
    if (val <= 3.5) return "😐";
    if (val <= 4.5) return "🙂";
    return "😊";
  };

  const formatCost = (val: number) => {
    if (val >= 1) return `$${val.toFixed(2)}`;
    if (val > 0) return `$${val.toFixed(4)}`;
    return "$0";
  };

  const formatTokens = (val: number) => {
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
    return String(val);
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

  const tabs: { id: TabType; label: string; icon: any }[] = [
    { id: "dashboard", label: "Дашборд", icon: BarChart3 },
    { id: "users", label: "Пользователи", icon: Users },
    { id: "content", label: "Контент", icon: MessageSquare },
    { id: "settings", label: "Настройки", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-surface-50 p-4 lg:p-8">
      <Helmet>
        <title>Админ-панель — Ника</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-surface-900">Админ-панель</h1>
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-1.5 text-xs font-medium text-surface-600 transition-colors hover:bg-surface-100"
            >
              <Download className="h-3.5 w-3.5" />
              Экспорт CSV
            </button>
            <button
              onClick={loadData}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-1.5 text-xs font-medium text-surface-600 transition-colors hover:bg-surface-100 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Обновить
            </button>
          </div>
        </div>

        <div className="mb-6 flex gap-1 rounded-xl bg-white p-1 shadow-sm">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === t.id
                  ? "bg-primary-600 text-white"
                  : "text-surface-500 hover:bg-surface-50"
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
            <button onClick={() => setError("")} className="ml-2 font-medium underline">Закрыть</button>
          </div>
        )}

        {tab === "dashboard" && stats && extended && (
          <div className="space-y-6">
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
              <StatCard icon={Users} label="Пользователи" value={stats.users} iconBg="bg-primary-100" iconColor="text-primary-600" sub={`+${extended.users_last_7d} за 7д`} />
              <StatCard icon={MessageSquare} label="Сессии" value={stats.sessions} iconBg="bg-emerald-100" iconColor="text-emerald-600" sub={`${extended.sessions_today} сегодня`} />
              <StatCard icon={BarChart3} label="Сообщения" value={stats.messages} iconBg="bg-amber-100" iconColor="text-amber-600" />
              <StatCard icon={Zap} label="Токены" value={formatTokens(stats.total_tokens)} iconBg="bg-violet-100" iconColor="text-violet-600" sub={`+${formatTokens(extended.tokens_today)} сегодня`} />
              <StatCard icon={DollarSign} label="Стоимость" value={formatCost(stats.estimated_cost)} iconBg="bg-rose-100" iconColor="text-rose-600" sub={`$${extended.token_price}/токен`} />
              <StatCard icon={Activity} label="DAU" value={extended.dau} iconBg="bg-sky-100" iconColor="text-sky-600" sub={`WAU ${extended.wau} / MAU ${extended.mau}`} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-surface-100 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <Activity className="h-5 w-5 text-primary-600" />
                  <h2 className="text-base font-semibold text-surface-900">Сессии за 30 дней</h2>
                </div>
                <MiniChart data={extended.daily_sessions} dataKey="count" color="#10B981" />
                <div className="mt-3 flex gap-4 text-xs text-surface-500">
                  <span>7д: {extended.sessions_last_7d}</span>
                  <span>30д: {extended.sessions_last_30d}</span>
                </div>
              </div>

              <div className="rounded-2xl border border-surface-100 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <MessageSquare className="h-5 w-5 text-primary-600" />
                  <h2 className="text-base font-semibold text-surface-900">Сообщения за 30 дней</h2>
                </div>
                <MiniChart data={extended.daily_messages} dataKey="count" color="#F59E0B" />
              </div>

              <div className="rounded-2xl border border-surface-100 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <Zap className="h-5 w-5 text-primary-600" />
                  <h2 className="text-base font-semibold text-surface-900">Токены за 30 дней</h2>
                </div>
                <MiniChart data={extended.daily_tokens} dataKey="tokens" color="#8B5CF6" />
                <div className="mt-3 flex gap-4 text-xs text-surface-500">
                  <span>7д: {formatTokens(extended.tokens_last_7d)}</span>
                  <span>30д: {formatTokens(extended.tokens_last_30d)}</span>
                </div>
              </div>

              <div className="rounded-2xl border border-surface-100 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <Heart className="h-5 w-5 text-primary-600" />
                  <h2 className="text-base font-semibold text-surface-900">Настроение за 30 дней</h2>
                </div>
                <MiniChart data={extended.daily_mood.filter((d) => d.avg_mood !== null)} dataKey="avg_mood" color="#EC4899" />
                {extended.avg_mood_last_30d !== null && (
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-surface-500">
                    <Smile className="h-3.5 w-3.5" />
                    Среднее: {moodEmoji(extended.avg_mood_last_30d)} {extended.avg_mood_last_30d}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-surface-100 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-base font-semibold text-surface-900">Финансовые метрики</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl bg-surface-50 p-4">
                  <p className="text-xs text-surface-500">Сегодня</p>
                  <p className="mt-1 text-lg font-bold text-surface-900">{formatCost(extended.cost_today)}</p>
                  <p className="text-xs text-surface-400">{formatTokens(extended.tokens_today)} токенов</p>
                </div>
                <div className="rounded-xl bg-surface-50 p-4">
                  <p className="text-xs text-surface-500">7 дней</p>
                  <p className="mt-1 text-lg font-bold text-surface-900">{formatCost(extended.cost_last_7d)}</p>
                  <p className="text-xs text-surface-400">{formatTokens(extended.tokens_last_7d)} токенов</p>
                </div>
                <div className="rounded-xl bg-surface-50 p-4">
                  <p className="text-xs text-surface-500">30 дней</p>
                  <p className="mt-1 text-lg font-bold text-surface-900">{formatCost(extended.cost_last_30d)}</p>
                  <p className="text-xs text-surface-400">{formatTokens(extended.tokens_last_30d)} токенов</p>
                </div>
                <div className="rounded-xl bg-surface-50 p-4">
                  <p className="text-xs text-surface-500">Всего</p>
                  <p className="mt-1 text-lg font-bold text-surface-900">{formatCost(extended.cost_total)}</p>
                  <p className="text-xs text-surface-400">{formatTokens(extended.tokens_total)} токенов</p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-surface-100 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <TrendingUp className="h-5 w-5 text-primary-600" />
                  <h2 className="text-base font-semibold text-surface-900">Удержание и активация</h2>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-surface-500">Активация (создали сессию)</span>
                    <span className="text-xs font-semibold text-surface-800">{extended.activation_rate}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-100">
                    <div className="h-full rounded-full bg-primary-600" style={{ width: `${Math.min(extended.activation_rate, 100)}%` }} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-surface-500">Возврат (2+ сессии)</span>
                    <span className="text-xs font-semibold text-surface-800">{extended.retention_7d}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-100">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(extended.retention_7d, 100)}%` }} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-surface-500">Завершение сессий (15+ обменов)</span>
                    <span className="text-xs font-semibold text-surface-800">{extended.sessions_completed_pct}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-100">
                    <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.min(extended.sessions_completed_pct, 100)}%` }} />
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-surface-100 pt-3">
                    <span className="text-xs text-surface-500">Средняя длина сессии</span>
                    <span className="text-xs font-semibold text-surface-800">{extended.avg_session_length_exchanges} обменов</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-surface-100 bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-base font-semibold text-surface-900">Использование агентов</h2>
                <div className="space-y-2">
                  {Object.entries(extended.agent_usage)
                    .sort(([, a], [, b]) => b - a)
                    .map(([agentId, count]) => {
                      const agentInfo = AGENTS.find((a) => a.id === agentId);
                      const maxCount = Math.max(...Object.values(extended.agent_usage), 1);
                      return (
                        <div key={agentId} className="flex items-center gap-2">
                          <span className="w-16 shrink-0 text-xs text-surface-600">
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
                          <span className="w-10 text-right text-xs font-medium text-surface-500">{count}</span>
                        </div>
                      );
                    })}
                </div>
              </div>

              <div className="rounded-2xl border border-surface-100 bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-base font-semibold text-surface-900">Топ темы (30д)</h2>
                <div className="space-y-2">
                  {extended.top_topics.slice(0, 10).map((item, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="inline-flex rounded-full bg-surface-100 px-2.5 py-0.5 text-xs font-medium text-surface-700">
                        {item.topic || "Без темы"}
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
          </div>
        )}

        {tab === "users" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                <input
                  type="text"
                  placeholder="Поиск по имени или email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-surface-200 py-2 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none"
                />
              </div>
              <select
                value={activeFilter === null ? "" : activeFilter ? "active" : "inactive"}
                onChange={(e) => {
                  const v = e.target.value;
                  setActiveFilter(v === "" ? null : v === "active");
                }}
                className="rounded-lg border border-surface-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
              >
                <option value="">Все статусы</option>
                <option value="active">Активные</option>
                <option value="inactive">Неактивные</option>
              </select>
            </div>

            <div className="rounded-2xl border border-surface-100 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-surface-100 text-left text-xs font-medium uppercase tracking-wider text-surface-500">
                      <th className="cursor-pointer px-4 py-3" onClick={() => handleSort("name")}>
                        <span className="inline-flex items-center gap-1">Имя <SortIcon field="name" /></span>
                      </th>
                      <th className="cursor-pointer px-4 py-3" onClick={() => handleSort("email")}>
                        <span className="inline-flex items-center gap-1">Email <SortIcon field="email" /></span>
                      </th>
                      <th className="cursor-pointer px-4 py-3" onClick={() => handleSort("sessions_count")}>
                        <span className="inline-flex items-center gap-1">Сессии <SortIcon field="sessions_count" /></span>
                      </th>
                      <th className="cursor-pointer px-4 py-3" onClick={() => handleSort("messages_count")}>
                        <span className="inline-flex items-center gap-1">Сообщения <SortIcon field="messages_count" /></span>
                      </th>
                      <th className="cursor-pointer px-4 py-3" onClick={() => handleSort("tokens_total")}>
                        <span className="inline-flex items-center gap-1">Токены <SortIcon field="tokens_total" /></span>
                      </th>
                      <th className="px-4 py-3">Стоимость</th>
                      <th className="cursor-pointer px-4 py-3" onClick={() => handleSort("created_at")}>
                        <span className="inline-flex items-center gap-1">Регистрация <SortIcon field="created_at" /></span>
                      </th>
                      <th className="px-4 py-3">Статус</th>
                      <th className="px-4 py-3">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100">
                    {users.map((u) => (
                      <tr key={u.id} className="text-sm hover:bg-surface-50">
                        <td className="px-4 py-3 font-medium text-surface-900">{u.name || "—"}</td>
                        <td className="px-4 py-3 text-surface-600">{u.email}</td>
                        <td className="px-4 py-3 text-surface-600">{u.sessions_count}</td>
                        <td className="px-4 py-3 text-surface-600">{u.messages_count}</td>
                        <td className="px-4 py-3 text-surface-600">{formatTokens(u.tokens_total)}</td>
                        <td className="px-4 py-3 text-surface-600">{formatCost(u.cost_total)}</td>
                        <td className="px-4 py-3 text-surface-500">{new Date(u.created_at).toLocaleDateString("ru-RU")}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              u.is_active ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                            }`}
                          >
                            {u.is_active ? "Активен" : "Выкл"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleOpenUser(u.id)}
                              className="rounded-lg p-1.5 text-surface-500 transition-colors hover:bg-surface-100"
                              title="Подробнее"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleToggleStatus(u.id)}
                              className={`rounded-lg p-1.5 transition-colors ${
                                u.is_active
                                  ? "text-red-500 hover:bg-red-50"
                                  : "text-emerald-500 hover:bg-emerald-50"
                              }`}
                              title={u.is_active ? "Деактивировать" : "Активировать"}
                            >
                              {u.is_active ? <ShieldOff className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {users.length === 0 && (
                <div className="py-8 text-center text-sm text-surface-400">Пользователи не найдены</div>
              )}
            </div>
          </div>
        )}

        {tab === "content" && (
          <div className="rounded-2xl border border-surface-100 bg-white shadow-sm">
            <div className="border-b border-surface-100 px-6 py-4">
              <h2 className="text-base font-semibold text-surface-900">
                Анонимные инсайты
                {insights && (
                  <span className="ml-2 text-sm font-normal text-surface-500">
                    ({insights.total} всего, {insights.pending_count} на проверке)
                  </span>
                )}
              </h2>
            </div>
            <div className="divide-y divide-surface-100">
              {insights?.insights.map((i) => (
                <div key={i.id} className="flex items-start gap-4 px-6 py-4">
                  <div className="flex-1">
                    <p className="text-sm text-surface-700">{i.content}</p>
                    <div className="mt-2 flex gap-3 text-xs text-surface-400">
                      <span>{new Date(i.created_at).toLocaleDateString("ru-RU")}</span>
                      <span>{i.reactions} реакций</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleToggleInsight(i.id)}
                      className={`rounded-lg p-2 transition-colors ${
                        i.is_approved
                          ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                          : "bg-surface-100 text-surface-400 hover:bg-surface-200"
                      }`}
                      title={i.is_approved ? "Одобрено (нажмите для отмены)" : "На проверке (нажмите для одобрения)"}
                    >
                      {i.is_approved ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              ))}
              {(!insights || insights.insights.length === 0) && (
                <div className="py-8 text-center text-sm text-surface-400">Нет инсайтов</div>
              )}
            </div>
          </div>
        )}

        {tab === "settings" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-surface-100 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-base font-semibold text-surface-900">Финансовые настройки</h2>
              <div className="max-w-md space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-surface-700">
                    Цена за 1 токен ($)
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    min="0"
                    value={tokenPrice}
                    onChange={(e) => setTokenPrice(e.target.value)}
                    className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                    placeholder="0.00001"
                  />
                  <p className="mt-1 text-xs text-surface-400">
                    Стоимость одного токена в USD. Используется для расчёта финансовых метрик.
                  </p>
                </div>
                <button
                  onClick={handleSaveSettings}
                  className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
                >
                  Сохранить
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-surface-100 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-base font-semibold text-surface-900">Экспорт данных</h2>
              <p className="mb-4 text-sm text-surface-600">Скачайте CSV-файл со статистикой всех пользователей.</p>
              <button
                onClick={handleExport}
                className="inline-flex items-center gap-2 rounded-lg border border-surface-200 px-4 py-2 text-sm font-medium text-surface-700 transition-colors hover:bg-surface-50"
              >
                <Download className="h-4 w-4" />
                Скачать users.csv
              </button>
            </div>
          </div>
        )}

        {showUserModal && selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowUserModal(false)}>
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-6 flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-surface-900">{selectedUser.name || "Без имени"}</h2>
                  <p className="text-sm text-surface-500">{selectedUser.email}</p>
                  <p className="mt-1 text-xs text-surface-400">
                    Регистрация: {new Date(selectedUser.created_at).toLocaleDateString("ru-RU")}
                  </p>
                </div>
                <button
                  onClick={() => setShowUserModal(false)}
                  className="rounded-lg p-2 text-surface-400 hover:bg-surface-100"
                >
                  <AlertCircle className="h-5 w-5" />
                </button>
              </div>

              <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl bg-surface-50 p-3">
                  <p className="text-xs text-surface-500">Сессии</p>
                  <p className="text-lg font-bold text-surface-900">{selectedUser.total_sessions}</p>
                </div>
                <div className="rounded-xl bg-surface-50 p-3">
                  <p className="text-xs text-surface-500">Сообщения</p>
                  <p className="text-lg font-bold text-surface-900">{selectedUser.total_messages}</p>
                </div>
                <div className="rounded-xl bg-surface-50 p-3">
                  <p className="text-xs text-surface-500">Токены</p>
                  <p className="text-lg font-bold text-surface-900">{formatTokens(selectedUser.total_tokens)}</p>
                </div>
                <div className="rounded-xl bg-surface-50 p-3">
                  <p className="text-xs text-surface-500">Стоимость</p>
                  <p className="text-lg font-bold text-surface-900">{formatCost(selectedUser.total_cost)}</p>
                </div>
              </div>

              <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl bg-surface-50 p-3">
                  <p className="text-xs text-surface-500">Настроение</p>
                  <p className="text-lg font-bold text-surface-900">
                    {selectedUser.avg_mood !== null ? `${moodEmoji(selectedUser.avg_mood)} ${selectedUser.avg_mood}` : "—"}
                  </p>
                </div>
                <div className="rounded-xl bg-surface-50 p-3">
                  <p className="text-xs text-surface-500">Дневники</p>
                  <p className="text-lg font-bold text-surface-900">{selectedUser.diary_entries_count}</p>
                </div>
                <div className="rounded-xl bg-surface-50 p-3">
                  <p className="text-xs text-surface-500">Задачи</p>
                  <p className="text-lg font-bold text-surface-900">
                    {selectedUser.tasks_completed}/{selectedUser.tasks_count}
                  </p>
                </div>
                <div className="rounded-xl bg-surface-50 p-3">
                  <p className="text-xs text-surface-500">Достижения</p>
                  <p className="text-lg font-bold text-surface-900">{selectedUser.achievements.length}</p>
                </div>
              </div>

              {selectedUser.achievements.length > 0 && (
                <div className="mb-6">
                  <h3 className="mb-2 text-sm font-semibold text-surface-900">Достижения</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedUser.achievements.map((a, i) => (
                      <span key={i} className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                        {a.achievement_type}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="mb-2 text-sm font-semibold text-surface-900">Последние сессии</h3>
                <div className="space-y-2">
                  {selectedUser.sessions.slice(0, 10).map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded-xl bg-surface-50 px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-surface-900">{s.title || "Без названия"}</p>
                        <p className="text-xs text-surface-400">{new Date(s.created_at).toLocaleDateString("ru-RU")} — {s.message_count} сообщений</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-surface-500">{formatTokens(s.tokens)} токенов</p>
                        <p className="text-xs text-surface-400">{formatCost(s.cost)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

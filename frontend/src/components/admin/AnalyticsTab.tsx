import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  Link2,
  Plus,
  RefreshCw,
  Wallet,
} from "lucide-react";
import api from "@/api/client";

/**
 * Acquisition analytics.
 *
 * The table is built around one column — **цена за D1-возврат** — because that
 * is the number the reinvestment decision is made on. Everything else explains
 * why that number came out the way it did. Rows are sorted so the cheapest
 * D1-return sits at the top by default.
 */

interface SourceRow {
  code: string;
  channel_name: string | null;
  is_active: boolean;
  origin: string;
  clicks: number;
  bot_starts: number;
  tests_completed: number;
  first_messages: number;
  third_messages: number;
  returned_d1: number;
  paywall_clicks: number;
  cost_rub: number;
  cpa_rub: number | null;
  cost_per_d1_rub: number | null;
  conv_click_to_start: number;
  conv_start_to_first_msg: number;
  conv_first_to_third_msg: number;
  conv_start_to_d1: number;
}

interface Campaign {
  id: string;
  code: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  channel_name: string | null;
  cost_rub: number;
  placed_at: string | null;
  is_active: boolean;
  origin: string;
  bot_url: string | null;
  web_url: string;
}

interface CohortRow {
  cohort: string;
  size: number;
  d1: number; d1_pct: number;
  d3: number; d3_pct: number;
  d7: number; d7_pct: number;
  d14: number; d14_pct: number;
}

interface FunnelStep {
  event_type: string;
  label: string;
  count: number;
  pct_of_top: number;
  pct_of_previous: number;
}

interface SafetyData {
  crisis_detected: number;
  crisis_resources_shown: number;
  sessions_total: number;
  sessions_flagged: number;
  flagged_share_pct: number;
  by_campaign: { code: string; count: number }[];
}

interface SpendData {
  enabled: boolean;
  today_usd: number;
  today_tokens: number;
  daily_limit_usd: number;
  daily_pct: number;
  new_users_blocked: boolean;
  month_usd: number;
  month_tokens: number;
  user_daily_token_limit: number;
  history: { day: string; usd: number; tokens: number; calls: number }[];
}

type SortKey = keyof SourceRow;

const PERIODS = [7, 14, 30, 90];

export default function AnalyticsTab() {
  const [days, setDays] = useState(30);
  const [rows, setRows] = useState<SourceRow[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [cohorts, setCohorts] = useState<CohortRow[]>([]);
  const [funnel, setFunnel] = useState<FunnelStep[]>([]);
  const [safety, setSafety] = useState<SafetyData | null>(null);
  const [spend, setSpend] = useState<SpendData | null>(null);
  const [funnelSource, setFunnelSource] = useState<string>("");
  const [sortKey, setSortKey] = useState<SortKey>("cost_per_d1_rub");
  const [sortAsc, setSortAsc] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [srcRes, campRes, cohRes, safeRes, spendRes] = await Promise.all([
        api.get(`/admin/analytics/sources`, { params: { days } }),
        api.get(`/admin/analytics/campaigns`),
        api.get(`/admin/analytics/cohorts`, { params: { weeks: 8 } }),
        api.get(`/admin/analytics/safety`, { params: { days } }),
        api.get(`/admin/analytics/spend`),
      ]);
      setRows(srcRes.data.rows);
      setCampaigns(campRes.data.campaigns);
      setCohorts(cohRes.data.rows);
      setSafety(safeRes.data);
      setSpend(spendRes.data);
    } catch {
      setError("Не удалось загрузить аналитику");
    } finally {
      setLoading(false);
    }
  }, [days]);

  const loadFunnel = useCallback(async () => {
    try {
      const { data } = await api.get(`/admin/analytics/funnel`, {
        params: { days, campaign_code: funnelSource || undefined },
      });
      setFunnel(data.steps);
    } catch {
      /* keep the previous funnel rather than blanking the panel */
    }
  }, [days, funnelSource]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadFunnel(); }, [loadFunnel]);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      // Rows with no cost entered have no CPA — park them at the bottom
      // regardless of direction, they carry no decision value.
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      if (typeof av === "string" || typeof bv === "string") {
        return sortAsc
          ? String(av).localeCompare(String(bv))
          : String(bv).localeCompare(String(av));
      }
      return sortAsc ? Number(av) - Number(bv) : Number(bv) - Number(av);
    });
    return copy;
  }, [rows, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(key === "cost_per_d1_rub" || key === "cpa_rub");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl bg-white p-1 shadow-sm">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setDays(p)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                days === p ? "bg-primary-600 text-white" : "text-surface-500 hover:bg-surface-50"
              }`}
            >
              {p} дн
            </button>
          ))}
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 bg-white px-3 py-1.5 text-xs font-medium text-surface-600 hover:bg-surface-100 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Обновить
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <SpendPanel spend={spend} />
      <SourcesTable
        rows={sorted}
        sortKey={sortKey}
        sortAsc={sortAsc}
        onSort={toggleSort}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <FunnelPanel
          steps={funnel}
          rows={rows}
          selected={funnelSource}
          onSelect={setFunnelSource}
        />
        <SafetyPanel safety={safety} />
      </div>
      <CohortPanel rows={cohorts} />
      <CampaignsPanel campaigns={campaigns} onChanged={load} />
    </div>
  );
}

// ── Spend ─────────────────────────────────────────────────────────────────

function SpendPanel({ spend }: { spend: SpendData | null }) {
  if (!spend) return null;
  const pct = Math.min(spend.daily_pct, 100);
  const tone =
    spend.daily_pct >= 100 ? "bg-red-500" : spend.daily_pct >= 80 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div className="rounded-2xl border border-surface-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Wallet className="h-4 w-4 text-primary-600" />
        <h3 className="text-sm font-semibold text-surface-900">Расходы на LLM</h3>
        {!spend.enabled && (
          <span className="rounded-full bg-surface-100 px-2 py-0.5 text-[10px] text-surface-500">
            лимиты выключены
          </span>
        )}
      </div>

      {spend.new_users_blocked && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Дневной лимит исчерпан — <strong>приём новых пользователей остановлен</strong>.
            Существующие пользователи продолжают работать. Сброс в 00:00 UTC.
          </span>
        </div>
      )}

      <div className="mb-4 grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Metric label="Сегодня" value={`$${spend.today_usd.toFixed(2)}`} sub={`из $${spend.daily_limit_usd}`} />
        <Metric label="Токенов сегодня" value={spend.today_tokens.toLocaleString("ru")} />
        <Metric label="За месяц" value={`$${spend.month_usd.toFixed(2)}`} />
        <Metric
          label="Лимит на юзера/сутки"
          value={spend.user_daily_token_limit ? spend.user_daily_token_limit.toLocaleString("ru") : "—"}
          sub="токенов"
        />
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-surface-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1.5 text-[11px] text-surface-400">
        {spend.daily_pct}% дневного лимита · уведомления админу на 50 / 80 / 100%
      </p>
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-surface-500">{label}</p>
      <p className="text-lg font-bold text-surface-900">{value}</p>
      {sub && <p className="text-[11px] text-surface-400">{sub}</p>}
    </div>
  );
}

// ── Sources ───────────────────────────────────────────────────────────────

const COLUMNS: { key: SortKey; label: string; hint?: string }[] = [
  { key: "channel_name", label: "Источник" },
  { key: "clicks", label: "Клики" },
  { key: "bot_starts", label: "Старты бота" },
  { key: "tests_completed", label: "Тест пройден" },
  { key: "first_messages", label: "1-е сообщ." },
  { key: "third_messages", label: "3-е сообщ." },
  { key: "returned_d1", label: "Вернулись D1" },
  { key: "paywall_clicks", label: "Paywall клик" },
  { key: "cost_rub", label: "Затраты ₽" },
  { key: "cpa_rub", label: "CPA ₽", hint: "затраты / старты бота" },
  { key: "cost_per_d1_rub", label: "Цена D1-возврата ₽", hint: "затраты / вернувшиеся D1" },
];

function SourcesTable({
  rows, sortKey, sortAsc, onSort,
}: {
  rows: SourceRow[];
  sortKey: SortKey;
  sortAsc: boolean;
  onSort: (key: SortKey) => void;
}) {
  return (
    <div className="rounded-2xl border border-surface-100 bg-white shadow-sm">
      <div className="border-b border-surface-100 px-5 py-4">
        <h3 className="text-sm font-semibold text-surface-900">Источники трафика</h3>
        <p className="mt-0.5 text-[11px] text-surface-400">
          Решение о повторной закупке принимается по колонке «Цена D1-возврата»
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-surface-100 text-surface-500">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => onSort(col.key)}
                  title={col.hint}
                  className={`cursor-pointer whitespace-nowrap px-3 py-2.5 text-right font-medium hover:text-surface-900 first:text-left ${
                    col.key === "cost_per_d1_rub" ? "bg-primary-50 text-primary-700" : ""
                  }`}
                >
                  {col.label}
                  {sortKey === col.key && <span className="ml-1">{sortAsc ? "↑" : "↓"}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="px-3 py-8 text-center text-surface-400">
                  Пока нет данных за выбранный период
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.code} className="border-b border-surface-50 last:border-0 hover:bg-surface-50">
                <td className="px-3 py-2.5">
                  <span className="font-medium text-surface-900">{row.channel_name || row.code}</span>
                  <span className="ml-1.5 text-[10px] text-surface-400">{row.code}</span>
                  {row.origin === "auto_created" && (
                    <span className="ml-1.5 rounded bg-amber-50 px-1 py-0.5 text-[9px] text-amber-700">
                      auto
                    </span>
                  )}
                </td>
                <Cell value={row.clicks} />
                <Cell value={row.bot_starts} conv={row.conv_click_to_start} />
                <Cell value={row.tests_completed} />
                <Cell value={row.first_messages} conv={row.conv_start_to_first_msg} />
                <Cell value={row.third_messages} conv={row.conv_first_to_third_msg} />
                <Cell value={row.returned_d1} conv={row.conv_start_to_d1} highlight />
                <Cell value={row.paywall_clicks} />
                <Cell value={row.cost_rub ? Math.round(row.cost_rub) : 0} />
                <Cell value={row.cpa_rub} money />
                <td className="whitespace-nowrap bg-primary-50/60 px-3 py-2.5 text-right font-bold text-primary-700">
                  {row.cost_per_d1_rub !== null ? `${row.cost_per_d1_rub} ₽` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-surface-100 px-5 py-2.5 text-[11px] text-surface-400">
        «—» в CPA и цене возврата означает, что не внесены затраты или ещё нет возвратов.
        Затраты вносятся в карточке кампании ниже.
      </p>
    </div>
  );
}

function Cell({
  value, conv, money, highlight,
}: {
  value: number | null;
  conv?: number;
  money?: boolean;
  highlight?: boolean;
}) {
  return (
    <td className={`whitespace-nowrap px-3 py-2.5 text-right tabular-nums ${highlight ? "font-semibold text-surface-900" : "text-surface-700"}`}>
      {value === null ? "—" : money ? `${value} ₽` : value}
      {conv !== undefined && conv > 0 && (
        <span className="ml-1 text-[10px] text-surface-400">{conv}%</span>
      )}
    </td>
  );
}

// ── Funnel ────────────────────────────────────────────────────────────────

function FunnelPanel({
  steps, rows, selected, onSelect,
}: {
  steps: FunnelStep[];
  rows: SourceRow[];
  selected: string;
  onSelect: (code: string) => void;
}) {
  const top = steps[0]?.count ?? 0;
  return (
    <div className="rounded-2xl border border-surface-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-surface-900">Воронка</h3>
        <select
          value={selected}
          onChange={(e) => onSelect(e.target.value)}
          className="rounded-lg border border-surface-200 px-2 py-1 text-xs text-surface-600"
        >
          <option value="">Все источники</option>
          {rows.map((r) => (
            <option key={r.code} value={r.code}>
              {r.channel_name || r.code}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        {steps.map((step, i) => (
          <div key={step.event_type}>
            <div className="mb-1 flex items-baseline justify-between text-xs">
              <span className="text-surface-600">{step.label}</span>
              <span className="tabular-nums text-surface-900">
                <strong>{step.count}</strong>
                {i > 0 && (
                  <span className="ml-1.5 text-[10px] text-surface-400">
                    {step.pct_of_previous}% от пред.
                  </span>
                )}
              </span>
            </div>
            <div className="h-6 overflow-hidden rounded-lg bg-surface-100">
              <div
                className="flex h-full items-center rounded-lg bg-primary-500/80 px-2 text-[10px] font-medium text-white"
                style={{ width: `${top ? Math.max((step.count / top) * 100, 2) : 2}%` }}
              >
                {step.pct_of_top > 8 && `${step.pct_of_top}%`}
              </div>
            </div>
          </div>
        ))}
        {steps.length === 0 && <p className="text-xs text-surface-400">Нет данных</p>}
      </div>
    </div>
  );
}

// ── Safety ────────────────────────────────────────────────────────────────

function SafetyPanel({ safety }: { safety: SafetyData | null }) {
  if (!safety) return null;
  // Rule of thumb for creative review, not a clinical threshold.
  const alarming = safety.flagged_share_pct >= 10;

  return (
    <div className="rounded-2xl border border-surface-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <AlertTriangle className={`h-4 w-4 ${alarming ? "text-red-500" : "text-surface-400"}`} />
        <h3 className="text-sm font-semibold text-surface-900">Мониторинг безопасности</h3>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4">
        <Metric label="Кризис детектирован" value={String(safety.crisis_detected)} />
        <Metric label="Контакты показаны" value={String(safety.crisis_resources_shown)} />
        <Metric label="Сессий с флагом" value={String(safety.sessions_flagged)} sub={`из ${safety.sessions_total}`} />
        <Metric label="Доля сессий" value={`${safety.flagged_share_pct}%`} />
      </div>

      {alarming && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
          Высокая доля кризисных сессий — креативы приводят слишком тяжёлую аудиторию.
          Имеет смысл сменить формулировки в объявлениях.
        </p>
      )}

      {safety.by_campaign.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] font-medium text-surface-500">По источникам</p>
          <ul className="space-y-1">
            {safety.by_campaign.slice(0, 6).map((item) => (
              <li key={item.code} className="flex justify-between text-xs text-surface-600">
                <span>{item.code}</span>
                <span className="tabular-nums">{item.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-3 text-[10.5px] leading-relaxed text-surface-400">
        Только счётчики. Содержимое диалогов в аналитику не попадает.
      </p>
    </div>
  );
}

// ── Cohorts ───────────────────────────────────────────────────────────────

function CohortPanel({ rows }: { rows: CohortRow[] }) {
  return (
    <div className="rounded-2xl border border-surface-100 bg-white shadow-sm">
      <div className="border-b border-surface-100 px-5 py-4">
        <h3 className="text-sm font-semibold text-surface-900">Когортное удержание</h3>
        <p className="mt-0.5 text-[11px] text-surface-400">Недели привлечения × дни возврата</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-surface-100 text-surface-500">
              <th className="px-3 py-2.5 text-left font-medium">Когорта</th>
              <th className="px-3 py-2.5 text-right font-medium">Размер</th>
              {["D1", "D3", "D7", "D14"].map((d) => (
                <th key={d} className="px-3 py-2.5 text-right font-medium">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-surface-400">Нет данных</td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.cohort} className="border-b border-surface-50 last:border-0">
                <td className="px-3 py-2.5 font-medium text-surface-900">{row.cohort}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-surface-700">{row.size}</td>
                {(["d1", "d3", "d7", "d14"] as const).map((key) => {
                  const pct = row[`${key}_pct` as const];
                  return (
                    <td key={key} className="px-3 py-2.5 text-right tabular-nums">
                      <span
                        className="inline-block rounded px-1.5 py-0.5"
                        style={{
                          background: pct > 0 ? `rgba(184,120,90,${Math.min(pct / 60, 1) * 0.35})` : "transparent",
                        }}
                      >
                        {row[key]} <span className="text-surface-400">({pct}%)</span>
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Campaigns + link generator ────────────────────────────────────────────

function CampaignsPanel({
  campaigns, onChanged,
}: {
  campaigns: Campaign[];
  onChanged: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    code: "", channel_name: "", utm_source: "telegram",
    utm_medium: "cpm", utm_campaign: "", cost_rub: "",
  });
  const [formError, setFormError] = useState("");
  const [costDrafts, setCostDrafts] = useState<Record<string, string>>({});

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError("");
    try {
      await api.post("/admin/analytics/campaigns", {
        code: form.code.trim(),
        channel_name: form.channel_name || form.code,
        utm_source: form.utm_source || null,
        utm_medium: form.utm_medium || null,
        utm_campaign: form.utm_campaign || form.code,
        cost_rub: Number(form.cost_rub) || 0,
      });
      setForm({ code: "", channel_name: "", utm_source: "telegram", utm_medium: "cpm", utm_campaign: "", cost_rub: "" });
      setCreating(false);
      onChanged();
    } catch (err: any) {
      setFormError(err?.response?.data?.detail?.[0]?.msg || err?.response?.data?.detail || "Не удалось создать кампанию");
    }
  };

  const saveCost = async (campaign: Campaign) => {
    const draft = costDrafts[campaign.id];
    if (draft === undefined) return;
    try {
      await api.patch(`/admin/analytics/campaigns/${campaign.id}`, {
        cost_rub: Number(draft) || 0,
      });
      setCostDrafts((prev) => {
        const next = { ...prev };
        delete next[campaign.id];
        return next;
      });
      onChanged();
    } catch {
      /* leave the draft in place so the value isn't lost */
    }
  };

  return (
    <div className="rounded-2xl border border-surface-100 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-surface-100 px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-surface-900">Кампании и ссылки</h3>
          <p className="mt-0.5 text-[11px] text-surface-400">
            Готовые ссылки — копируй и вставляй в объявление, руками ничего собирать не нужно
          </p>
        </div>
        <button
          onClick={() => setCreating((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700"
        >
          <Plus className="h-3.5 w-3.5" />
          Кампания
        </button>
      </div>

      {creating && (
        <form onSubmit={handleCreate} className="border-b border-surface-100 bg-surface-50 px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Код (A-Za-z0-9_-)" value={form.code} onChange={(v) => setForm((f) => ({ ...f, code: v }))} placeholder="tg_bezfiltrov_01" />
            <Field label="Название площадки" value={form.channel_name} onChange={(v) => setForm((f) => ({ ...f, channel_name: v }))} placeholder="Канал «Без фильтров»" />
            <Field label="utm_source" value={form.utm_source} onChange={(v) => setForm((f) => ({ ...f, utm_source: v }))} />
            <Field label="utm_medium" value={form.utm_medium} onChange={(v) => setForm((f) => ({ ...f, utm_medium: v }))} />
            <Field label="utm_campaign" value={form.utm_campaign} onChange={(v) => setForm((f) => ({ ...f, utm_campaign: v }))} placeholder="= код, если пусто" />
            <Field label="Затраты ₽" value={form.cost_rub} onChange={(v) => setForm((f) => ({ ...f, cost_rub: v }))} placeholder="5000" />
          </div>
          {formError && <p className="mt-2 text-xs text-red-600">{String(formError)}</p>}
          <button type="submit" className="mt-3 rounded-lg bg-primary-600 px-4 py-2 text-xs font-medium text-white hover:bg-primary-700">
            Создать
          </button>
        </form>
      )}

      <div className="divide-y divide-surface-50">
        {campaigns.length === 0 && (
          <p className="px-5 py-8 text-center text-xs text-surface-400">Кампаний пока нет</p>
        )}
        {campaigns.map((campaign) => (
          <div key={campaign.id} className="px-5 py-4">
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-surface-900">
                {campaign.channel_name || campaign.code}
              </span>
              <code className="rounded bg-surface-100 px-1.5 py-0.5 text-[10px] text-surface-600">
                {campaign.code}
              </code>
              {campaign.origin === "auto_created" && (
                <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700">
                  создана автоматически
                </span>
              )}
              {!campaign.is_active && (
                <span className="rounded bg-surface-100 px-1.5 py-0.5 text-[10px] text-surface-500">
                  выключена
                </span>
              )}
            </div>

            <div className="mb-3 space-y-1.5">
              {campaign.bot_url && <LinkRow label="Бот" url={campaign.bot_url} />}
              <LinkRow label="Веб" url={campaign.web_url} />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-[11px] text-surface-500">Затраты ₽</label>
              <input
                value={costDrafts[campaign.id] ?? String(campaign.cost_rub || "")}
                onChange={(e) =>
                  setCostDrafts((prev) => ({ ...prev, [campaign.id]: e.target.value }))
                }
                className="w-28 rounded-lg border border-surface-200 px-2 py-1 text-xs tabular-nums"
                inputMode="decimal"
              />
              {costDrafts[campaign.id] !== undefined && (
                <button
                  onClick={() => saveCost(campaign)}
                  className="inline-flex items-center gap-1 rounded-lg bg-primary-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-primary-700"
                >
                  <Check className="h-3 w-3" /> Сохранить
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-surface-500">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-surface-200 px-2.5 py-1.5 text-xs"
      />
    </label>
  );
}

function LinkRow({ label, url }: { label: string; url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable — the text stays selectable */
    }
  };
  return (
    <div className="flex items-center gap-2">
      <span className="w-8 shrink-0 text-[10px] font-medium text-surface-400">{label}</span>
      <code className="min-w-0 flex-1 truncate rounded bg-surface-50 px-2 py-1 text-[11px] text-surface-600">
        {url}
      </code>
      <button
        onClick={copy}
        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-surface-200 px-2 py-1 text-[10px] text-surface-600 hover:bg-surface-100"
      >
        {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
        {copied ? "Скопировано" : "Копировать"}
      </button>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="shrink-0 rounded-lg border border-surface-200 p-1 text-surface-500 hover:bg-surface-100"
        title="Открыть"
      >
        <Link2 className="h-3 w-3" />
      </a>
    </div>
  );
}

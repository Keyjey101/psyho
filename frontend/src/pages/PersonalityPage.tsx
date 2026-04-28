import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/api/client";
import { ArrowLeft, BarChart2 } from "lucide-react";

interface PersonalityData {
  id: string;
  self_awareness: number;
  emotional_regulation: number;
  self_compassion: number;
  acceptance: number;
  values_clarity: number;
  resourcefulness: number;
  dominant_theme: string | null;
  summary_note: string | null;
  created_at: string;
}

interface PersonalityResponse {
  snapshot: PersonalityData | null;
  history: PersonalityData[];
}

const DIMENSIONS = [
  { key: "self_awareness", label: "Самоосознанность", tip: "поговори с Никой о своих реакциях и паттернах поведения" },
  { key: "emotional_regulation", label: "Эмоц. регуляция", tip: "попробуй упражнение на дыхание или соматические техники" },
  { key: "self_compassion", label: "Самосострадание", tip: "обсуди с Никой, как ты относишься к собственным ошибкам" },
  { key: "acceptance", label: "Принятие", tip: "поговори о том, что тяжело принять прямо сейчас" },
  { key: "values_clarity", label: "Ясность ценностей", tip: "исследуй с Никой, что по-настоящему важно для тебя" },
  { key: "resourcefulness", label: "Ресурсность", tip: "расскажи Нике, что тебя восстанавливает и даёт энергию" },
] as const;

const DIM_SVG_LABEL: Record<string, string> = {
  self_awareness: "Осознан.",
  emotional_regulation: "Эмоц. рег.",
  self_compassion: "Самосостр.",
  acceptance: "Принятие",
  values_clarity: "Ясность цен.",
  resourcefulness: "Ресурсность",
};

function getTrend(history: PersonalityData[], key: keyof PersonalityData): string {
  if (history.length < 2) return "";
  const sorted = [...history].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const prev = sorted[sorted.length - 2][key] as number;
  const curr = sorted[sorted.length - 1][key] as number;
  if (curr > prev) return "↑";
  if (curr < prev) return "↓";
  return "";
}

function getOverallTrend(history: PersonalityData[]): "up" | "down" | "stable" {
  if (history.length < 2) return "stable";
  const keys = DIMENSIONS.map((d) => d.key);
  const sorted = [...history].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const prev = sorted[sorted.length - 2];
  const curr = sorted[sorted.length - 1];
  const delta = keys.reduce((sum, k) => sum + ((curr[k] as number) - (prev[k] as number)), 0);
  if (delta > 5) return "up";
  if (delta < -5) return "down";
  return "stable";
}

function RadarChart({ data }: { data: PersonalityData }) {
  const values = DIMENSIONS.map((d) => data[d.key] as number);
  const size = 300;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = 120;

  const points = DIMENSIONS.map((_, i) => {
    const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
    const r = maxR * (values[i] / 100);
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  });

  const gridLevels = [25, 50, 75, 100];

  const polygonStr = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="px-10">
      <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto" width={size} height={size} overflow="visible">
        {gridLevels.map((level) => {
          const r = maxR * (level / 100);
          const pts = DIMENSIONS.map((_, i) => {
            const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
            return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
          }).join(" ");
          return (
            <polygon key={level} points={pts} fill="none" stroke="#E8DDD0" strokeWidth={1} />
          );
        })}
        {DIMENSIONS.map((_, i) => {
          const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
          return (
            <line
              key={i}
              x1={cx} y1={cy}
              x2={cx + maxR * Math.cos(angle)}
              y2={cy + maxR * Math.sin(angle)}
              stroke="#E8DDD0" strokeWidth={1}
            />
          );
        })}
        <polygon
          points={polygonStr}
          fill="#B8785A"
          fillOpacity={0.25}
          stroke="#B8785A"
          strokeWidth={2}
          style={{ transition: "all 0.5s ease" }}
        />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={4} fill="#B8785A" />
        ))}
        {DIMENSIONS.map((dim, i) => {
          const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
          const lx = cx + (maxR + 24) * Math.cos(angle);
          const ly = cy + (maxR + 24) * Math.sin(angle);
          return (
            <text
              key={dim.key}
              x={lx} y={ly}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-[#8A7A6A]"
              fontSize={10}
            >
              {DIM_SVG_LABEL[dim.key]}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function MiniTrendChart({ history }: { history: PersonalityData[] }) {
  if (history.length < 2) return null;
  const sorted = [...history].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const avgs = sorted.map((snap) => {
    const sum = DIMENSIONS.reduce((s, d) => s + (snap[d.key] as number), 0);
    return Math.round(sum / DIMENSIONS.length);
  });

  const w = 280;
  const h = 60;
  const minV = Math.max(0, Math.min(...avgs) - 10);
  const maxV = Math.min(100, Math.max(...avgs) + 10);
  const xStep = w / (avgs.length - 1);

  const pts = avgs.map((v, i) => {
    const x = i * xStep;
    const y = h - ((v - minV) / (maxV - minV)) * h;
    return `${x},${y}`;
  });

  return (
    <div className="mb-8 rounded-2xl border border-[#E8DDD0] bg-white p-6 shadow-sm dark:border-[#4A4038] dark:bg-[#352E2A]">
      <h2 className="mb-4 text-[15px] font-semibold text-[#5A5048] dark:text-[#F5EDE4]">Динамика роста</h2>
      <svg viewBox={`0 0 ${w} ${h + 20}`} className="w-full" height={h + 20}>
        <polyline
          points={pts.join(" ")}
          fill="none"
          stroke="#B8785A"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {avgs.map((v, i) => (
          <g key={i}>
            <circle
              cx={i * xStep}
              cy={h - ((v - minV) / (maxV - minV)) * h}
              r={4}
              fill="#B8785A"
            />
            <text
              x={i * xStep}
              y={h + 16}
              textAnchor="middle"
              fontSize={9}
              fill="#B8A898"
            >
              {new Date(sorted[i].created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export default function PersonalityPage() {
  const [data, setData] = useState<PersonalityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .get("/user/me/personality")
      .then(({ data }) => setData(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const snapshot = data?.snapshot;
  const history = data?.history ?? [];

  const dimValues = snapshot
    ? DIMENSIONS.map((d) => ({ ...d, value: snapshot[d.key] as number }))
    : [];

  const topDims = [...dimValues].sort((a, b) => b.value - a.value).slice(0, 2);
  const bottomDims = [...dimValues].sort((a, b) => a.value - b.value).filter((d) => d.value < 50).slice(0, 2);
  const overallTrend = getOverallTrend(history);

  return (
    <div className="min-h-screen bg-[#FAF6F1] p-6 lg:p-10 dark:bg-[#2A2420]">
      <div className="mx-auto max-w-3xl">
        <button
          onClick={() => navigate("/chat")}
          className="mb-6 flex items-center gap-2 text-sm text-[#8A7A6A] hover:text-[#5A5048] dark:text-[#B8A898] dark:hover:text-[#F5EDE4]"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад к чату
        </button>

        <div className="mb-8 flex items-center gap-3">
          <BarChart2 className="h-6 w-6 text-[#B8785A] dark:text-[#C08B68]" />
          <h1 className="text-2xl font-bold text-[#5A5048] dark:text-[#F5EDE4]">Мой психопортрет</h1>
        </div>

        {loading && (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#E8DDD0] border-t-[#B8785A]" />
          </div>
        )}

        {!loading && !snapshot && (
          <div className="rounded-2xl border border-[#E8DDD0] bg-white p-8 text-center shadow-sm dark:border-[#4A4038] dark:bg-[#352E2A]">
            <img src="/illustrations/opt/profile_flower.webp" alt="" className="mb-3 mx-auto h-16 w-16 object-contain" />
            <p className="text-[15px] font-medium text-[#5A5048] dark:text-[#F5EDE4]">Психопортрет в пути</p>
            <p className="mt-2 text-[13px] text-[#8A7A6A] dark:text-[#B8A898]">
              Психопортрет станет доступен после 3 завершённых сессий. Продолжай общаться с Никой!
            </p>
          </div>
        )}

        {!loading && snapshot && (
          <>
            {/* Overall trend banner */}
            {overallTrend !== "stable" && history.length >= 2 && (
              <div className={`mb-6 rounded-2xl p-4 text-center ${
                overallTrend === "up"
                  ? "bg-emerald-50 border border-emerald-100"
                  : "bg-amber-50 border border-amber-100"
              }`}>
                <p className="text-[15px] font-semibold">
                  {overallTrend === "up"
                    ? <><img src="/illustrations/opt/profile_flower.webp" alt="" className="inline h-4 w-4 object-contain align-middle mr-1" /> Ты растёшь — общий показатель улучшился!</>
                    : "💫 Продолжай работать — это тоже часть пути"}
                </p>
              </div>
            )}

            {/* Radar chart */}
            <div className="mb-6 rounded-2xl border border-[#E8DDD0] bg-white p-6 shadow-sm dark:border-[#4A4038] dark:bg-[#352E2A]">
              <RadarChart data={snapshot} />
            </div>

            {/* Strengths */}
            {topDims.length > 0 && topDims[0].value >= 50 && (
              <div className="mb-6 rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
                <h2 className="mb-3 text-[14px] font-semibold text-emerald-800">💪 Твои сильные стороны</h2>
                <div className="flex flex-wrap gap-2">
                  {topDims.map((d) => (
                    <div key={d.key} className="rounded-full bg-white px-4 py-1.5 text-[13px] font-medium text-emerald-700 border border-emerald-100 shadow-sm">
                      {d.label} — {d.value}%
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Dimension bars */}
            <div className="mb-6 space-y-3">
              {dimValues.map((dim) => {
                const trend = getTrend(history, dim.key);
                return (
                  <div
                    key={dim.key}
                    className="rounded-xl border border-[#E8DDD0] bg-white px-4 py-3 dark:border-[#4A4038] dark:bg-[#352E2A]"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-32 shrink-0 text-sm font-medium text-[#5A5048] dark:text-[#F5EDE4] sm:w-40">
                        {DIM_SVG_LABEL[dim.key]}
                      </span>
                      <div className="flex-1">
                        <div className="h-2.5 overflow-hidden rounded-full bg-[#F5EDE4] dark:bg-[#4A4038]">
                          <div
                            className="h-full rounded-full bg-[#B8785A] transition-all dark:bg-[#C08B68]"
                            style={{ width: `${dim.value}%` }}
                          />
                        </div>
                      </div>
                      <span className="w-8 text-right text-sm font-semibold text-[#5A5048] dark:text-[#F5EDE4]">
                        {dim.value}
                      </span>
                      {trend && (
                        <span
                          className={`text-sm font-bold ${
                            trend === "↑" ? "text-emerald-500" : "text-red-400"
                          }`}
                        >
                          {trend}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Growth zones */}
            {bottomDims.length > 0 && (
              <div className="mb-6 rounded-2xl border border-[#E8DDD0] bg-white p-5 shadow-sm dark:border-[#4A4038] dark:bg-[#352E2A]">
                <h2 className="mb-3 text-[14px] font-semibold text-[#5A5048] dark:text-[#F5EDE4]">🌿 Зоны роста</h2>
                <div className="space-y-3">
                  {bottomDims.map((d) => (
                    <div key={d.key} className="rounded-xl bg-[#FAF6F1] p-3 dark:bg-[#2A2420]">
                      <p className="text-[13px] font-medium text-[#5A5048] dark:text-[#F5EDE4]">{d.label}</p>
                      <p className="mt-0.5 text-[12px] text-[#8A7A6A] dark:text-[#B8A898]">
                        <img src="/illustrations/opt/action_insight.webp" alt="" className="inline h-3.5 w-3.5 object-contain align-middle mr-0.5" /> Попробуй: {d.tip}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Trend chart */}
            <MiniTrendChart history={history} />

            {/* Summary note */}
            {snapshot.summary_note && (
              <div className="rounded-2xl border border-[#E8DDD0] bg-white p-6 shadow-sm dark:border-[#4A4038] dark:bg-[#352E2A]">
                <h2 className="mb-2 text-[14px] font-semibold text-[#5A5048] dark:text-[#F5EDE4]">🔮 Наблюдение</h2>
                <p className="text-sm leading-relaxed text-[#8A7A6A] dark:text-[#B8A898]">
                  {snapshot.summary_note}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

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
  { key: "self_awareness", label: "Самоосознанность" },
  { key: "emotional_regulation", label: "Эмоц. регуляция" },
  { key: "self_compassion", label: "Самосострадание" },
  { key: "acceptance", label: "Принятие" },
  { key: "values_clarity", label: "Ясность ценностей" },
  { key: "resourcefulness", label: "Ресурсность" },
] as const;

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
  const axisPoints = DIMENSIONS.map((_, i) => {
    const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
    return {
      x: cx + maxR * Math.cos(angle),
      y: cy + maxR * Math.sin(angle),
      lx: cx + (maxR + 20) * Math.cos(angle),
      ly: cy + (maxR + 20) * Math.sin(angle),
    };
  });

  const polygonStr = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto" width={size} height={size}>
      {gridLevels.map((level) => {
        const r = maxR * (level / 100);
        const pts = DIMENSIONS.map((_, i) => {
          const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
          return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
        }).join(" ");
        return (
          <polygon
            key={level}
            points={pts}
            fill="none"
            stroke="#E8DDD0"
            strokeWidth={1}
            className="dark:stroke-[#4A4038]"
          />
        );
      })}
      {axisPoints.map((ap, i) => (
        <line
          key={i}
          x1={cx}
          y1={cy}
          x2={ap.x}
          y2={ap.y}
          stroke="#E8DDD0"
          strokeWidth={1}
          className="dark:stroke-[#4A4038]"
        />
      ))}
      <polygon
        points={polygonStr}
        fill="#B8785A"
        fillOpacity={0.25}
        stroke="#B8785A"
        strokeWidth={2}
        className="dark:stroke-[#C08B68]"
        style={{ transition: "all 0.5s ease" }}
      />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={4} fill="#B8785A" className="dark:fill-[#C08B68]" />
      ))}
      {DIMENSIONS.map((dim, i) => {
        const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
        const lx = cx + (maxR + 24) * Math.cos(angle);
        const ly = cy + (maxR + 24) * Math.sin(angle);
        return (
          <text
            key={dim.key}
            x={lx}
            y={ly}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-[#8A7A6A] dark:fill-[#B8A898]"
            fontSize={10}
          >
            {dim.label}
          </text>
        );
      })}
    </svg>
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

        {!loading && !data?.snapshot && (
          <div className="rounded-2xl border border-[#E8DDD0] bg-white p-8 text-center shadow-sm dark:border-[#4A4038] dark:bg-[#352E2A]">
            <p className="text-[#8A7A6A] dark:text-[#B8A898]">
              Психопортрет станет доступен после 3 завершённых сессий. Продолжай общаться с Никой!
            </p>
          </div>
        )}

        {!loading && data?.snapshot && (
          <>
            <div className="mb-8 rounded-2xl border border-[#E8DDD0] bg-white p-6 shadow-sm dark:border-[#4A4038] dark:bg-[#352E2A]">
              <RadarChart data={data.snapshot} />
            </div>

            <div className="mb-8 space-y-3">
              {DIMENSIONS.map((dim) => {
                const value = data.snapshot![dim.key] as number;
                const trend = getTrend(data.history, dim.key);
                return (
                  <div
                    key={dim.key}
                    className="rounded-xl border border-[#E8DDD0] bg-white px-4 py-3 dark:border-[#4A4038] dark:bg-[#352E2A]"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-32 shrink-0 text-sm font-medium text-[#5A5048] dark:text-[#F5EDE4] sm:w-40">
                        {dim.label}
                      </span>
                      <div className="flex-1">
                        <div className="h-2.5 overflow-hidden rounded-full bg-[#F5EDE4] dark:bg-[#4A4038]">
                          <div
                            className="h-full rounded-full bg-[#B8785A] transition-all dark:bg-[#C08B68]"
                            style={{ width: `${value}%` }}
                          />
                        </div>
                      </div>
                      <span className="w-8 text-right text-sm font-semibold text-[#5A5048] dark:text-[#F5EDE4]">
                        {value}
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

            {data.snapshot.summary_note && (
              <div className="rounded-2xl border border-[#E8DDD0] bg-white p-6 shadow-sm dark:border-[#4A4038] dark:bg-[#352E2A]">
                <p className="text-sm leading-relaxed text-[#8A7A6A] dark:text-[#B8A898]">
                  {data.snapshot.summary_note}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

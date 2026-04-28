import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/api/client";
import { ArrowLeft } from "lucide-react";

interface MoodEntry {
  id: string;
  value: number;
  note: string | null;
  session_id: string | null;
  created_at: string;
}

interface DayData {
  date: string;
  avg: number;
  entries: MoodEntry[];
}

function getMoodColor(avg: number | null): string {
  if (avg === null) return "#F0EBE5";
  if (avg <= 3) return "#E07070";
  if (avg <= 5) return "#E8C57A";
  if (avg <= 7) return "#A8D4A0";
  return "#4CAF76";
}

function getMoodLabel(avg: number): string {
  if (avg <= 2) return "Тяжело";
  if (avg <= 4) return "Плохо";
  if (avg <= 6) return "Нормально";
  if (avg <= 8) return "Хорошо";
  return "Отлично";
}

function SkeletonBlock({ h = "h-4", w = "w-full", className = "" }: { h?: string; w?: string; className?: string }) {
  return <div className={`animate-pulse rounded bg-[#E8DDD0] ${h} ${w} ${className}`} />;
}

export default function EmotionMap() {
  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<{ day: DayData; x: number; y: number } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/mood?limit=500")
      .then(({ data }) => setEntries(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Build 52-week grid (364 days back from today)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dayMap = new Map<string, MoodEntry[]>();
  entries.forEach((e) => {
    const d = new Date(e.created_at);
    d.setHours(0, 0, 0, 0);
    const key = d.toISOString().slice(0, 10);
    if (!dayMap.has(key)) dayMap.set(key, []);
    dayMap.get(key)!.push(e);
  });

  // Build 52 weeks × 7 days grid
  const WEEKS = 52;
  const DAYS = 7;

  // Find the start: go back to the beginning of the current week (Sunday)
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - (WEEKS * DAYS - 1));

  const weeks: Array<Array<DayData | null>> = [];
  for (let w = 0; w < WEEKS; w++) {
    const week: Array<DayData | null> = [];
    for (let d = 0; d < DAYS; d++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + w * DAYS + d);
      if (date > today) {
        week.push(null);
        continue;
      }
      const key = date.toISOString().slice(0, 10);
      const dayEntries = dayMap.get(key) || [];
      const avg = dayEntries.length > 0
        ? dayEntries.reduce((s, e) => s + e.value, 0) / dayEntries.length
        : null;
      week.push({
        date: key,
        avg: avg ?? 0,
        entries: dayEntries,
      });
    }
    weeks.push(week);
  }

  const MONTH_LABELS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  const DAY_LABELS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

  // Generate month label positions
  const monthLabels: Array<{ label: string; weekIdx: number }> = [];
  let prevMonth = -1;
  weeks.forEach((week, wi) => {
    const firstDay = week.find((d) => d !== null);
    if (firstDay) {
      const month = new Date(firstDay.date).getMonth();
      if (month !== prevMonth) {
        monthLabels.push({ label: MONTH_LABELS[month], weekIdx: wi });
        prevMonth = month;
      }
    }
  });

  const CELL_SIZE = 12;
  const CELL_GAP = 2;
  const step = CELL_SIZE + CELL_GAP;

  return (
    <div className="min-h-screen bg-[#FAF6F1] p-6 lg:p-10">
      <div className="mx-auto max-w-4xl">
        <button
          onClick={() => navigate("/mood")}
          className="mb-6 flex items-center gap-2 text-sm text-[#8A7A6A] hover:text-[#5A5048]"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад к трекеру
        </button>

        <h1 className="mb-2 text-2xl font-bold text-[#5A5048]">Карта эмоций</h1>
        <p className="mb-8 text-sm text-[#8A7A6A]">Тепловая карта твоего настроения за последний год</p>

        {loading && (
          <div className="rounded-2xl border border-[#E8DDD0] bg-white p-6 shadow-sm">
            <SkeletonBlock h="h-6" w="w-48" className="mb-4" />
            <SkeletonBlock h="h-32" />
          </div>
        )}

        {!loading && (
          <div className="rounded-2xl border border-[#E8DDD0] bg-white p-6 shadow-sm overflow-x-auto">
            <div className="relative" style={{ minWidth: weeks.length * step + 30 }}>
              {/* Month labels */}
              <div className="flex mb-1 ml-8" style={{ gap: 0 }}>
                {weeks.map((_, wi) => {
                  const label = monthLabels.find((m) => m.weekIdx === wi);
                  return (
                    <div
                      key={wi}
                      style={{ width: step, flexShrink: 0 }}
                      className="text-[9px] text-[#B8A898]"
                    >
                      {label?.label || ""}
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-0">
                {/* Day labels */}
                <div className="flex flex-col mr-1" style={{ gap: CELL_GAP }}>
                  {DAY_LABELS.map((d, i) => (
                    <div
                      key={d}
                      style={{ height: CELL_SIZE, width: 24 }}
                      className={`flex items-center text-[8px] text-[#B8A898] ${i % 2 === 0 ? "opacity-0" : ""}`}
                    >
                      {d}
                    </div>
                  ))}
                </div>

                {/* Grid */}
                <div className="flex" style={{ gap: CELL_GAP }}>
                  {weeks.map((week, wi) => (
                    <div key={wi} className="flex flex-col" style={{ gap: CELL_GAP }}>
                      {week.map((day, di) => {
                        if (day === null) {
                          return (
                            <div
                              key={di}
                              style={{ width: CELL_SIZE, height: CELL_SIZE, background: "transparent" }}
                            />
                          );
                        }
                        const hasData = day.entries.length > 0;
                        const color = hasData ? getMoodColor(day.avg) : "#F0EBE5";
                        return (
                          <div
                            key={di}
                            style={{
                              width: CELL_SIZE,
                              height: CELL_SIZE,
                              borderRadius: 2,
                              background: color,
                              cursor: hasData ? "pointer" : "default",
                            }}
                            onMouseEnter={(e) => {
                              if (hasData) {
                                setTooltip({ day, x: e.clientX, y: e.clientY });
                              }
                            }}
                            onMouseLeave={() => setTooltip(null)}
                            onClick={(e) => {
                              if (hasData) {
                                setTooltip(tooltip?.day.date === day.date ? null : { day, x: e.clientX, y: e.clientY });
                              }
                            }}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="mt-4 flex items-center gap-3 text-[11px] text-[#8A7A6A]">
              <span>Плохо</span>
              {["#E07070", "#E8C57A", "#A8D4A0", "#4CAF76"].map((c) => (
                <div key={c} style={{ width: 12, height: 12, borderRadius: 2, background: c }} />
              ))}
              <span>Отлично</span>
              <div className="ml-2 flex items-center gap-1">
                <div style={{ width: 12, height: 12, borderRadius: 2, background: "#F0EBE5" }} />
                <span>Нет данных</span>
              </div>
            </div>
          </div>
        )}

        {/* Summary stats */}
        {!loading && entries.length > 0 && (
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-2xl border border-[#E8DDD0] bg-white p-4 shadow-sm text-center">
              <p className="text-[12px] text-[#8A7A6A]">Всего записей</p>
              <p className="mt-1 text-2xl font-bold text-[#5A5048]">{entries.length}</p>
            </div>
            <div className="rounded-2xl border border-[#E8DDD0] bg-white p-4 shadow-sm text-center">
              <p className="text-[12px] text-[#8A7A6A]">Среднее</p>
              <p className="mt-1 text-2xl font-bold text-[#B8785A]">
                {(entries.reduce((s, e) => s + e.value, 0) / entries.length).toFixed(1)}
              </p>
            </div>
            <div className="rounded-2xl border border-[#E8DDD0] bg-white p-4 shadow-sm text-center">
              <p className="text-[12px] text-[#8A7A6A]">Активных дней</p>
              <p className="mt-1 text-2xl font-bold text-[#5A5048]">{dayMap.size}</p>
            </div>
            <div className="rounded-2xl border border-[#E8DDD0] bg-white p-4 shadow-sm text-center">
              <p className="text-[12px] text-[#8A7A6A]">Лучший день</p>
              <p className="mt-1 text-2xl font-bold text-emerald-600">
                {Math.max(...entries.map((e) => e.value))}
              </p>
            </div>
          </div>
        )}

        {!loading && entries.length === 0 && (
          <div className="mt-6 rounded-2xl border border-[#E8DDD0] bg-white p-8 text-center shadow-sm">
            <p className="mb-2 text-3xl">🗓️</p>
            <p className="text-[15px] font-medium text-[#5A5048]">Пока нет данных</p>
            <p className="mt-1 text-[13px] text-[#8A7A6A]">Отмечай настроение после сессий — карта начнёт заполняться</p>
          </div>
        )}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 rounded-xl border border-[#E8DDD0] bg-white p-3 shadow-lg text-[12px] pointer-events-none"
          style={{
            left: Math.min(tooltip.x + 12, window.innerWidth - 200),
            top: Math.min(tooltip.y - 60, window.innerHeight - 100),
          }}
        >
          <p className="font-semibold text-[#5A5048]">
            {new Date(tooltip.day.date).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
          </p>
          <p className="text-[#8A7A6A]">
            Среднее: <span className="font-medium">{tooltip.day.avg.toFixed(1)}</span> — {getMoodLabel(tooltip.day.avg)}
          </p>
          <p className="text-[#B8A898]">{tooltip.day.entries.length} запис{tooltip.day.entries.length === 1 ? "ь" : "и"}</p>
        </div>
      )}
    </div>
  );
}

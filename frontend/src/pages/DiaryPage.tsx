import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/api/client";
import { ArrowLeft, Plus, ChevronDown, ChevronUp } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DiaryEntry {
  id: string;
  session_id: string | null;
  content: string;
  topics: string[] | null;
  user_note: string | null;
  created_at: string;
}

interface MoodEntry {
  id: string;
  value: number;
  note: string | null;
  session_id: string | null;
  created_at: string;
}

interface SessionInfo {
  id: string;
  title: string | null;
}

interface TaskInfo {
  id: string;
  session_id: string;
  text: string;
  completed: boolean;
}

type Tab = "entries" | "history" | "map";

// ─── Constants ────────────────────────────────────────────────────────────────

const MOOD_EMOJIS: Record<number, string> = { 1: "😫", 2: "😟", 3: "😐", 4: "🙂", 5: "😊" };
const MOOD_LABELS: Record<number, string> = { 1: "Ужасно", 2: "Плохо", 3: "Нормально", 4: "Хорошо", 5: "Отлично" };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SkeletonBlock({ h = "h-4", w = "w-full", className = "" }: { h?: string; w?: string; className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-[#E8DDD0] dark:bg-[#4A4038] ${h} ${w} ${className}`} />;
}

function calcStreak(entries: MoodEntry[]): number {
  if (entries.length === 0) return 0;
  const days = new Set(entries.map((e) => new Date(e.created_at).toDateString()));
  const sorted = Array.from(days).map((d) => new Date(d).getTime()).sort((a, b) => b - a);
  let streak = 1;
  const DAY_MS = 86400000;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i - 1] - sorted[i] <= DAY_MS * 1.5) streak++;
    else break;
  }
  return streak;
}

// ─── Heatmap helpers ──────────────────────────────────────────────────────────

interface DayData { date: string; avg: number; entries: MoodEntry[] }

function getMoodColor(avg: number | null): string {
  if (!avg) return "#F0EBE5";
  if (avg <= 2) return "#E07070";
  if (avg <= 3) return "#E8C57A";
  if (avg <= 4) return "#A8D4A0";
  return "#4CAF76";
}

function getMoodLabel(avg: number): string {
  if (avg <= 2) return "Тяжело";
  if (avg <= 3) return "Плохо";
  if (avg <= 4) return "Нормально";
  return "Хорошо";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TabBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const labels: Record<Tab, string> = { entries: "Записи", history: "История", map: "Карта" };
  return (
    <div className="mb-6 flex rounded-2xl bg-[#F0EAE3] p-1 dark:bg-[#3A3028]">
      {(["entries", "history", "map"] as Tab[]).map((t) => (
        <button
          key={t}
          onClick={() => setTab(t)}
          className={`flex-1 rounded-xl py-2 text-sm font-medium transition-all ${
            tab === t
              ? "bg-white shadow-sm text-[#5A5048] dark:bg-[#4A4038] dark:text-[#F5EDE4]"
              : "text-[#8A7A6A] hover:text-[#5A5048] dark:text-[#B8A898] dark:hover:text-[#F5EDE4]"
          }`}
        >
          {labels[t]}
        </button>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DiaryPage() {
  const [tab, setTab] = useState<Tab>("entries");
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);
  const [moodEntries, setMoodEntries] = useState<MoodEntry[]>([]);
  const [sessionMap, setSessionMap] = useState<Record<string, string>>({});
  const [taskMap, setTaskMap] = useState<Record<string, TaskInfo>>({});
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [editingNote, setEditingNote] = useState<{ id: string; text: string } | null>(null);
  const [tooltip, setTooltip] = useState<{ day: DayData; x: number; y: number } | null>(null);
  const navigate = useNavigate();
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

  const fetchDiary = () =>
    api.get("/diary").then(({ data }) => setDiaryEntries(Array.isArray(data) ? data : [])).catch(() => {});

  useEffect(() => {
    Promise.all([
      fetchDiary(),
      api.get("/mood?limit=500").then(({ data }) => setMoodEntries(data)).catch(() => {}),
      api.get("/sessions?limit=100").then(({ data }: { data: SessionInfo[] }) => {
        const map: Record<string, string> = {};
        data.forEach((s) => { if (s.title) map[s.id] = s.title; });
        setSessionMap(map);
      }).catch(() => {}),
      api.get("/tasks/history").then(({ data }: { data: TaskInfo[] }) => {
        const map: Record<string, TaskInfo> = {};
        data.forEach((t) => { map[t.session_id] = t; });
        setTaskMap(map);
      }).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  // Build mood lookup by session_id
  const moodBySession: Record<string, MoodEntry> = {};
  moodEntries.forEach((e) => { if (e.session_id) moodBySession[e.session_id] = e; });

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await api.post("/diary/generate");
      await fetchDiary();
    } catch {
      // endpoint may fail if no sessions exist
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveNote = async (id: string, note: string) => {
    try {
      await api.patch(`/diary/${id}`, { user_note: note });
      setDiaryEntries((prev) => prev.map((e) => e.id === id ? { ...e, user_note: note } : e));
      setEditingNote(null);
    } catch { /* ignore */ }
  };

  // ── History tab data ─────────────────────────────────────────────────────────

  const recentEntries = moodEntries.slice().reverse().slice(-20);
  const avg = moodEntries.length > 0
    ? (moodEntries.reduce((s, e) => s + e.value, 0) / moodEntries.length).toFixed(1)
    : null;
  const streak = calcStreak(moodEntries);
  const exerciseDone = recentEntries.filter((e) => e.session_id && taskMap[e.session_id]?.completed);
  const exerciseNotDone = recentEntries.filter((e) => e.session_id && taskMap[e.session_id] && !taskMap[e.session_id].completed);
  const avgWithExercise = exerciseDone.length > 0
    ? exerciseDone.reduce((s, e) => s + e.value, 0) / exerciseDone.length : null;
  const avgWithoutExercise = exerciseNotDone.length > 0
    ? exerciseNotDone.reduce((s, e) => s + e.value, 0) / exerciseNotDone.length : null;

  // ── Heatmap data ─────────────────────────────────────────────────────────────

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const WEEKS = isMobile ? 26 : 52;
  const DAYS = 7;
  const CELL_SIZE = isMobile ? 11 : 12;
  const CELL_GAP = 2;
  const step = CELL_SIZE + CELL_GAP;

  const dayMap = new Map<string, MoodEntry[]>();
  moodEntries.forEach((e) => {
    const d = new Date(e.created_at);
    d.setHours(0, 0, 0, 0);
    const key = d.toISOString().slice(0, 10);
    if (!dayMap.has(key)) dayMap.set(key, []);
    dayMap.get(key)!.push(e);
  });

  const startDate = new Date(today);
  startDate.setDate(today.getDate() - (WEEKS * DAYS - 1));

  const weeks: Array<Array<DayData | null>> = [];
  for (let w = 0; w < WEEKS; w++) {
    const week: Array<DayData | null> = [];
    for (let d = 0; d < DAYS; d++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + w * DAYS + d);
      if (date > today) { week.push(null); continue; }
      const key = date.toISOString().slice(0, 10);
      const dayEntries = dayMap.get(key) || [];
      const dayAvg = dayEntries.length > 0 ? dayEntries.reduce((s, e) => s + e.value, 0) / dayEntries.length : null;
      week.push({ date: key, avg: dayAvg ?? 0, entries: dayEntries });
    }
    weeks.push(week);
  }

  const MONTH_LABELS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  const DAY_LABELS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

  const monthLabels: Array<{ label: string; weekIdx: number }> = [];
  let prevMonth = -1;
  weeks.forEach((week, wi) => {
    const firstDay = week.find((d) => d !== null);
    if (firstDay) {
      const month = new Date(firstDay.date).getMonth();
      if (month !== prevMonth) { monthLabels.push({ label: MONTH_LABELS[month], weekIdx: wi }); prevMonth = month; }
    }
  });

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#FAF6F1] p-4 dark:bg-[#2A2420] sm:p-6 lg:p-10">
      <div className="mx-auto max-w-3xl">
        <button
          onClick={() => navigate("/chat")}
          className="mb-6 flex items-center gap-2 text-sm text-[#8A7A6A] hover:text-[#5A5048] dark:text-[#B8A898] dark:hover:text-[#F5EDE4]"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад к чату
        </button>

        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[#5A5048] dark:text-[#F5EDE4]">Дневник</h1>
          {tab === "entries" && (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-2 rounded-xl bg-[#B8785A] px-4 py-2 text-sm font-medium text-white hover:bg-[#9A6248] disabled:opacity-60"
            >
              {generating ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Создать запись
            </button>
          )}
        </div>

        <TabBar tab={tab} setTab={setTab} />

        {/* ── Entries tab ──────────────────────────────────────────────────── */}
        {tab === "entries" && (
          <>
            {loading && (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="rounded-2xl border border-[#E8DDD0] bg-white p-5 shadow-sm dark:border-[#4A4038] dark:bg-[#352E2A]">
                    <SkeletonBlock h="h-3" w="w-24" className="mb-3" />
                    <SkeletonBlock h="h-4" w="w-3/4" className="mb-2" />
                    <SkeletonBlock h="h-3" w="w-full" className="mb-1" />
                    <SkeletonBlock h="h-3" w="w-2/3" />
                  </div>
                ))}
              </div>
            )}

            {!loading && diaryEntries.length === 0 && (
              <div className="rounded-2xl border border-[#E8DDD0] bg-white p-8 text-center shadow-sm dark:border-[#4A4038] dark:bg-[#352E2A]">
                <p className="mb-2 text-3xl">📓</p>
                <p className="text-[15px] font-medium text-[#5A5048] dark:text-[#F5EDE4]">Дневник пуст</p>
                <p className="mt-1 text-[13px] text-[#8A7A6A] dark:text-[#B8A898]">
                  Нажми «Создать запись» — Ника подготовит рефлексию на основе последней сессии
                </p>
              </div>
            )}

            {!loading && diaryEntries.length > 0 && (
              <div className="space-y-4">
                {diaryEntries.map((entry) => {
                  const isExpanded = expandedId === entry.id;
                  const preview = entry.content.slice(0, 200);
                  const hasMore = entry.content.length > 200;
                  const mood = entry.session_id ? moodBySession[entry.session_id] : null;

                  return (
                    <div key={entry.id} className="rounded-2xl border border-[#E8DDD0] bg-white p-5 shadow-sm dark:border-[#4A4038] dark:bg-[#352E2A]">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] text-[#B8A898]">
                            {new Date(entry.created_at).toLocaleDateString("ru-RU", {
                              day: "numeric", month: "long", year: "numeric",
                            })}
                          </span>
                          {entry.session_id && sessionMap[entry.session_id] && (
                            <span className="rounded-full bg-[#F5EDE4] px-2 py-0.5 text-[10px] font-medium text-[#B8785A] dark:bg-[#4A4038] dark:text-[#C08B68]">
                              {sessionMap[entry.session_id]}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {mood && (
                            <span
                              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                              style={{ background: getMoodColor(mood.value), color: mood.value <= 3 ? "#7A2A2A" : "#1A4A2A" }}
                              title={MOOD_LABELS[mood.value]}
                            >
                              {MOOD_EMOJIS[mood.value]} {mood.value}/5
                            </span>
                          )}
                          {entry.topics && entry.topics.length > 0 && entry.topics.slice(0, 2).map((t) => (
                            <span key={t} className="rounded-full bg-[#F5EDE4] px-2 py-0.5 text-[10px] font-medium text-[#B8785A] dark:bg-[#4A4038] dark:text-[#C08B68]">
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>

                      <p className="text-[14px] leading-relaxed text-[#5A5048] dark:text-[#E8D8C8]">
                        {isExpanded ? entry.content : preview}
                        {!isExpanded && hasMore && "..."}
                      </p>

                      {hasMore && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                          className="mt-2 flex items-center gap-1 text-[12px] text-[#B8785A] hover:text-[#9A6248]"
                        >
                          {isExpanded ? <><ChevronUp className="h-3.5 w-3.5" /> Свернуть</> : <><ChevronDown className="h-3.5 w-3.5" /> Читать полностью</>}
                        </button>
                      )}

                      <div className="mt-3 border-t border-[#F0EAE3] pt-3 dark:border-[#4A4038]">
                        {editingNote?.id === entry.id ? (
                          <div className="space-y-2">
                            <textarea
                              value={editingNote.text}
                              onChange={(e) => setEditingNote({ id: entry.id, text: e.target.value })}
                              className="w-full rounded-xl border border-[#E8DDD0] bg-[#FAF6F1] px-3 py-2 text-[13px] text-[#5A5048] outline-none focus:border-[#B8785A] min-h-[64px] resize-none dark:border-[#4A4038] dark:bg-[#2A2420] dark:text-[#F5EDE4]"
                              placeholder="Добавь своё наблюдение..."
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleSaveNote(entry.id, editingNote.text)}
                                className="rounded-lg bg-[#B8785A] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[#9A6248]"
                              >
                                Сохранить
                              </button>
                              <button
                                onClick={() => setEditingNote(null)}
                                className="rounded-lg px-3 py-1.5 text-[12px] text-[#8A7A6A] hover:bg-[#F5EDE4] dark:hover:bg-[#4A4038]"
                              >
                                Отмена
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div onClick={() => setEditingNote({ id: entry.id, text: entry.user_note || "" })} className="cursor-pointer">
                            {entry.user_note ? (
                              <p className="text-[12px] italic text-[#8A7A6A] dark:text-[#B8A898]">{entry.user_note}</p>
                            ) : (
                              <p className="text-[12px] text-[#B8A898] hover:text-[#8A7A6A]">+ Добавить заметку</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── History tab ──────────────────────────────────────────────────── */}
        {tab === "history" && (
          <>
            {loading && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="rounded-2xl border border-[#E8DDD0] bg-white p-5 shadow-sm dark:border-[#4A4038] dark:bg-[#352E2A]">
                      <SkeletonBlock h="h-3" w="w-16" className="mb-3" />
                      <SkeletonBlock h="h-8" w="w-24" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!loading && avg && (
              <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-[#E8DDD0] bg-white p-5 shadow-sm dark:border-[#4A4038] dark:bg-[#352E2A]">
                  <p className="text-[12px] text-[#8A7A6A] dark:text-[#B8A898]">Среднее</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-3xl">{MOOD_EMOJIS[Math.round(Number(avg))]}</span>
                    <span className="text-2xl font-bold text-[#5A5048] dark:text-[#F5EDE4]">{avg}</span>
                  </div>
                </div>
                <div className="rounded-2xl border border-[#E8DDD0] bg-white p-5 shadow-sm dark:border-[#4A4038] dark:bg-[#352E2A]">
                  <p className="text-[12px] text-[#8A7A6A] dark:text-[#B8A898]">Записей</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-3xl">📝</span>
                    <span className="text-2xl font-bold text-[#5A5048] dark:text-[#F5EDE4]">{moodEntries.length}</span>
                  </div>
                </div>
                {streak > 1 && (
                  <div className="rounded-2xl border border-orange-100 bg-orange-50 p-5 shadow-sm dark:border-orange-900/30 dark:bg-orange-950/30">
                    <p className="text-[12px] text-orange-600 dark:text-orange-400">Серия дней</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-3xl">🔥</span>
                      <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">{streak}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!loading && avgWithExercise !== null && avgWithoutExercise !== null && (
              <div className="mb-6 rounded-2xl border border-emerald-100 bg-emerald-50 p-5 dark:border-emerald-900/30 dark:bg-emerald-950/30">
                <h2 className="mb-2 text-[14px] font-semibold text-emerald-800 dark:text-emerald-400">💡 Упражнения и настроение</h2>
                <div className="flex flex-wrap gap-4 text-[13px]">
                  <div>
                    <span className="text-emerald-700 font-medium dark:text-emerald-400">С упражнениями:</span>
                    <span className="ml-1 font-bold text-emerald-800 dark:text-emerald-300">{avgWithExercise.toFixed(1)} {MOOD_EMOJIS[Math.round(avgWithExercise)]}</span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Без упражнений:</span>
                    <span className="ml-1 font-bold text-gray-700 dark:text-gray-300">{avgWithoutExercise.toFixed(1)} {MOOD_EMOJIS[Math.round(avgWithoutExercise)]}</span>
                  </div>
                </div>
                {avgWithExercise > avgWithoutExercise + 0.3 && (
                  <p className="mt-2 text-[12px] text-emerald-700 dark:text-emerald-400">
                    ✨ Когда ты выполняешь упражнения, настроение заметно лучше!
                  </p>
                )}
              </div>
            )}

            {!loading && recentEntries.length > 0 && (
              <div className="mb-6 rounded-2xl border border-[#E8DDD0] bg-white p-6 shadow-sm dark:border-[#4A4038] dark:bg-[#352E2A]">
                <h2 className="mb-4 text-[15px] font-semibold text-[#5A5048] dark:text-[#F5EDE4]">История настроений</h2>
                <div className="flex h-36 items-end gap-1.5">
                  {recentEntries.map((entry) => {
                    const sessionTitle = entry.session_id ? sessionMap[entry.session_id] : null;
                    const task = entry.session_id ? taskMap[entry.session_id] : null;
                    return (
                      <div
                        key={entry.id}
                        className="group relative flex flex-1 flex-col items-center gap-1"
                        title={sessionTitle ? `${sessionTitle}${task ? (task.completed ? " ✅" : " ❌") : ""}` : undefined}
                      >
                        <span className="text-base leading-none">{MOOD_EMOJIS[entry.value]}</span>
                        <div
                          className="w-full rounded-t transition-all group-hover:opacity-80"
                          style={{
                            height: `${(entry.value / 5) * 100}%`,
                            background: task?.completed ? "#6EBF8B" : "#B8785A",
                          }}
                        />
                        {task && <span className="text-[9px] leading-none">{task.completed ? "✅" : "❌"}</span>}
                        <span className="text-[9px] text-[#B8A898]">
                          {new Date(entry.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                        </span>
                        {sessionTitle && (
                          <div className="pointer-events-none absolute bottom-full mb-2 hidden w-36 rounded-lg border border-[#E8DDD0] bg-white p-2 text-[10px] text-[#5A5048] shadow-md group-hover:block z-10 dark:border-[#4A4038] dark:bg-[#352E2A] dark:text-[#F5EDE4]">
                            <p className="font-medium leading-tight">{sessionTitle}</p>
                            {task && <p className="mt-0.5 text-[#8A7A6A]">Упражнение: {task.completed ? "выполнено ✅" : "не выполнено ❌"}</p>}
                            <p className="mt-0.5 text-[#B8A898]">{MOOD_LABELS[entry.value]}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 flex items-center gap-3 text-[11px] text-[#B8A898]">
                  <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#6EBF8B]" /> Упражнение выполнено</span>
                  <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#B8785A]" /> Без упражнения</span>
                </div>
              </div>
            )}

            {!loading && moodEntries.length === 0 && (
              <div className="rounded-2xl border border-[#E8DDD0] bg-white p-8 text-center shadow-sm dark:border-[#4A4038] dark:bg-[#352E2A]">
                <p className="mb-2 text-3xl">🌤️</p>
                <p className="text-[15px] font-medium text-[#5A5048] dark:text-[#F5EDE4]">Пока нет записей</p>
                <p className="mt-1 text-[13px] text-[#8A7A6A] dark:text-[#B8A898]">Оценивай настроение после каждой сессии — это поможет отслеживать прогресс.</p>
              </div>
            )}

            {!loading && moodEntries.length > 1 && (
              <p className="mb-6 text-center text-[13px] text-[#B8A898]">
                Ты уже {moodEntries.length} раз{moodEntries.length === 1 ? "" : "а"} отмечал(а) настроение — продолжай! 🌱
              </p>
            )}
          </>
        )}

        {/* ── Map tab ───────────────────────────────────────────────────────── */}
        {tab === "map" && (
          <>
            <p className="mb-4 text-sm text-[#8A7A6A] dark:text-[#B8A898]">
              Тепловая карта настроения за {isMobile ? "последние полгода" : "последний год"}
            </p>

            {loading && (
              <div className="rounded-2xl border border-[#E8DDD0] bg-white p-6 shadow-sm dark:border-[#4A4038] dark:bg-[#352E2A]">
                <SkeletonBlock h="h-32" />
              </div>
            )}

            {!loading && (
              <div className="relative rounded-2xl border border-[#E8DDD0] bg-white p-5 shadow-sm dark:border-[#4A4038] dark:bg-[#352E2A]">
                {/* fade right edge hint */}
                <div className="pointer-events-none absolute right-0 top-0 h-full w-8 rounded-r-2xl bg-gradient-to-l from-white to-transparent dark:from-[#352E2A]" />
                <div className="overflow-x-auto">
                  <div className="relative pb-1" style={{ minWidth: weeks.length * step + 34 }}>
                    {/* Month labels */}
                    <div className="flex mb-1 ml-8" style={{ gap: 0 }}>
                      {weeks.map((_, wi) => {
                        const label = monthLabels.find((m) => m.weekIdx === wi);
                        return (
                          <div key={wi} style={{ width: step, flexShrink: 0 }} className="text-[9px] text-[#B8A898]">
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
                              if (day === null) return <div key={di} style={{ width: CELL_SIZE, height: CELL_SIZE, background: "transparent" }} />;
                              const hasData = day.entries.length > 0;
                              const color = hasData ? getMoodColor(day.avg) : "#F0EBE5";
                              return (
                                <div
                                  key={di}
                                  style={{ width: CELL_SIZE, height: CELL_SIZE, borderRadius: 2, background: color, cursor: hasData ? "pointer" : "default" }}
                                  onMouseEnter={(e) => { if (hasData) setTooltip({ day, x: e.clientX, y: e.clientY }); }}
                                  onMouseLeave={() => setTooltip(null)}
                                  onClick={(e) => { if (hasData) setTooltip(tooltip?.day.date === day.date ? null : { day, x: e.clientX, y: e.clientY }); }}
                                />
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Legend */}
                <div className="mt-4 flex items-center gap-2 text-[11px] text-[#8A7A6A] dark:text-[#B8A898]">
                  <span>Плохо</span>
                  {["#E07070", "#E8C57A", "#A8D4A0", "#4CAF76"].map((c) => (
                    <div key={c} style={{ width: 11, height: 11, borderRadius: 2, background: c, flexShrink: 0 }} />
                  ))}
                  <span>Отлично</span>
                  <div className="ml-1 flex items-center gap-1">
                    <div style={{ width: 11, height: 11, borderRadius: 2, background: "#F0EBE5", flexShrink: 0 }} />
                    <span>Нет данных</span>
                  </div>
                </div>
              </div>
            )}

            {/* Summary stats */}
            {!loading && moodEntries.length > 0 && (
              <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  { label: "Всего записей", value: moodEntries.length, color: "text-[#5A5048] dark:text-[#F5EDE4]" },
                  {
                    label: "Среднее",
                    value: (moodEntries.reduce((s, e) => s + e.value, 0) / moodEntries.length).toFixed(1),
                    color: "text-[#B8785A]",
                  },
                  { label: "Активных дней", value: dayMap.size, color: "text-[#5A5048] dark:text-[#F5EDE4]" },
                  { label: "Лучший день", value: Math.max(...moodEntries.map((e) => e.value)), color: "text-emerald-600" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-2xl border border-[#E8DDD0] bg-white p-4 shadow-sm text-center dark:border-[#4A4038] dark:bg-[#352E2A]">
                    <p className="text-[12px] text-[#8A7A6A] dark:text-[#B8A898]">{label}</p>
                    <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
                  </div>
                ))}
              </div>
            )}

            {!loading && moodEntries.length === 0 && (
              <div className="mt-6 rounded-2xl border border-[#E8DDD0] bg-white p-8 text-center shadow-sm dark:border-[#4A4038] dark:bg-[#352E2A]">
                <p className="mb-2 text-3xl">🗓️</p>
                <p className="text-[15px] font-medium text-[#5A5048] dark:text-[#F5EDE4]">Пока нет данных</p>
                <p className="mt-1 text-[13px] text-[#8A7A6A] dark:text-[#B8A898]">Отмечай настроение после сессий — карта начнёт заполняться</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Global tooltip for heatmap */}
      {tooltip && (
        <div
          className="fixed z-50 rounded-xl border border-[#E8DDD0] bg-white p-3 shadow-lg text-[12px] pointer-events-none dark:border-[#4A4038] dark:bg-[#352E2A]"
          style={{
            left: Math.min(tooltip.x + 12, window.innerWidth - 210),
            top: Math.min(tooltip.y - 60, window.innerHeight - 100),
          }}
        >
          <p className="font-semibold text-[#5A5048] dark:text-[#F5EDE4]">
            {new Date(tooltip.day.date).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
          </p>
          <p className="text-[#8A7A6A] dark:text-[#B8A898]">
            Среднее: <span className="font-medium">{tooltip.day.avg.toFixed(1)}</span> — {getMoodLabel(tooltip.day.avg)}
          </p>
          <p className="text-[#B8A898]">{tooltip.day.entries.length} запис{tooltip.day.entries.length === 1 ? "ь" : "и"}</p>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "@/api/client";
import { ArrowLeft } from "lucide-react";

function SkeletonBlock({ h = "h-4", w = "w-full", className = "" }: { h?: string; w?: string; className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-[#E8DDD0] ${h} ${w} ${className}`} />;
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

const MOOD_EMOJIS: Record<number, string> = {
  1: "😫",
  2: "😟",
  3: "😐",
  4: "🙂",
  5: "😊",
};

const MOOD_LABELS: Record<number, string> = {
  1: "Ужасно",
  2: "Плохо",
  3: "Нормально",
  4: "Хорошо",
  5: "Отлично",
};

function calcStreak(entries: MoodEntry[]): number {
  if (entries.length === 0) return 0;
  const days = new Set(
    entries.map((e) => new Date(e.created_at).toDateString())
  );
  const sorted = Array.from(days)
    .map((d) => new Date(d).getTime())
    .sort((a, b) => b - a);

  let streak = 1;
  const DAY_MS = 86400000;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i - 1] - sorted[i] <= DAY_MS * 1.5) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

export default function MoodPage() {
  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [sessionMap, setSessionMap] = useState<Record<string, string>>({});
  const [taskMap, setTaskMap] = useState<Record<string, TaskInfo>>({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      api.get("/mood").then(({ data }) => setEntries(data)).catch(() => {}),
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

  const avg = entries.length > 0
    ? (entries.reduce((s, e) => s + e.value, 0) / entries.length).toFixed(1)
    : null;

  const streak = calcStreak(entries);

  const recentEntries = entries.slice().reverse().slice(-20);

  const exerciseDone = recentEntries.filter(
    (e) => e.session_id && taskMap[e.session_id]?.completed
  );
  const exerciseNotDone = recentEntries.filter(
    (e) => e.session_id && taskMap[e.session_id] && !taskMap[e.session_id].completed
  );

  const avgWithExercise =
    exerciseDone.length > 0
      ? exerciseDone.reduce((s, e) => s + e.value, 0) / exerciseDone.length
      : null;
  const avgWithoutExercise =
    exerciseNotDone.length > 0
      ? exerciseNotDone.reduce((s, e) => s + e.value, 0) / exerciseNotDone.length
      : null;

  return (
    <div className="min-h-screen bg-[#FAF6F1] p-6 lg:p-10">
      <div className="mx-auto max-w-3xl">
        <button
          onClick={() => navigate("/chat")}
          className="mb-6 flex items-center gap-2 text-sm text-[#8A7A6A] hover:text-[#5A5048]"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад к чату
        </button>

        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[#5A5048]">Трекер настроения</h1>
          <Link
            to="/emotion-map"
            className="text-sm text-[#B8785A] hover:text-[#9A6248]"
          >
            Тепловая карта →
          </Link>
        </div>

        {loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-2xl border border-[#E8DDD0] bg-white p-5 shadow-sm">
                  <SkeletonBlock h="h-3" w="w-16" className="mb-3" />
                  <SkeletonBlock h="h-8" w="w-24" />
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-[#E8DDD0] bg-white p-6 shadow-sm">
              <SkeletonBlock h="h-4" w="w-24" className="mb-4" />
              <div className="flex h-36 items-end gap-1.5">
                {Array.from({ length: 10 }).map((_, i) => (
                  <SkeletonBlock key={i} h={`h-${[16, 24, 20, 28, 12, 32, 20, 24, 16, 28][i]}`} className="flex-1" />
                ))}
              </div>
            </div>
          </div>
        )}

        {!loading && avg && (
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-[#E8DDD0] bg-white p-5 shadow-sm">
              <p className="text-[12px] text-[#8A7A6A]">Среднее</p>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-3xl">{MOOD_EMOJIS[Math.round(Number(avg))]}</span>
                <span className="text-2xl font-bold text-[#5A5048]">{avg}</span>
              </div>
            </div>
            <div className="rounded-2xl border border-[#E8DDD0] bg-white p-5 shadow-sm">
              <p className="text-[12px] text-[#8A7A6A]">Записей</p>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-3xl">📝</span>
                <span className="text-2xl font-bold text-[#5A5048]">{entries.length}</span>
              </div>
            </div>
            {streak > 1 && (
              <div className="rounded-2xl border border-orange-100 bg-orange-50 p-5 shadow-sm">
                <p className="text-[12px] text-orange-600">Серия дней</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="text-3xl">🔥</span>
                  <span className="text-2xl font-bold text-orange-600">{streak}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Exercise correlation */}
        {!loading && avgWithExercise !== null && avgWithoutExercise !== null && (
          <div className="mb-6 rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
            <h2 className="mb-2 text-[14px] font-semibold text-emerald-800">💡 Упражнения и настроение</h2>
            <div className="flex gap-6 text-[13px]">
              <div>
                <span className="text-emerald-700 font-medium">После выполненных упражнений:</span>
                <span className="ml-1 font-bold text-emerald-800">{avgWithExercise.toFixed(1)} {MOOD_EMOJIS[Math.round(avgWithExercise)]}</span>
              </div>
              <div>
                <span className="text-gray-600">Без выполнения:</span>
                <span className="ml-1 font-bold text-gray-700">{avgWithoutExercise.toFixed(1)} {MOOD_EMOJIS[Math.round(avgWithoutExercise)]}</span>
              </div>
            </div>
            {avgWithExercise > avgWithoutExercise + 0.3 && (
              <p className="mt-2 text-[12px] text-emerald-700">
                ✨ Когда ты выполняешь упражнения, настроение заметно лучше!
              </p>
            )}
          </div>
        )}

        {/* Chart */}
        {!loading && recentEntries.length > 0 && (
          <div className="mb-6 rounded-2xl border border-[#E8DDD0] bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-[15px] font-semibold text-[#5A5048]">История</h2>
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
                    {task && (
                      <span className="text-[9px] leading-none" title={task.text}>
                        {task.completed ? "✅" : "❌"}
                      </span>
                    )}
                    <span className="text-[9px] text-[#B8A898]">
                      {new Date(entry.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                    </span>
                    {/* Tooltip */}
                    {sessionTitle && (
                      <div className="pointer-events-none absolute bottom-full mb-2 hidden w-36 rounded-lg border border-[#E8DDD0] bg-white p-2 text-[10px] text-[#5A5048] shadow-md group-hover:block z-10">
                        <p className="font-medium leading-tight">{sessionTitle}</p>
                        {task && (
                          <p className="mt-0.5 text-[#8A7A6A]">
                            Упражнение: {task.completed ? "выполнено ✅" : "не выполнено ❌"}
                          </p>
                        )}
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

        {/* Session details list */}
        {!loading && recentEntries.length > 0 && (
          <div className="mb-6 rounded-2xl border border-[#E8DDD0] bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-[15px] font-semibold text-[#5A5048]">По сессиям</h2>
            <div className="space-y-2">
              {recentEntries.slice().reverse().map((entry) => {
                const sessionTitle = entry.session_id ? sessionMap[entry.session_id] : null;
                const task = entry.session_id ? taskMap[entry.session_id] : null;
                return (
                  <div key={entry.id} className="flex items-start gap-3 rounded-xl bg-[#FAF6F1] px-4 py-3">
                    <span className="mt-0.5 text-xl shrink-0">{MOOD_EMOJIS[entry.value]}</span>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-[13px] font-medium text-[#5A5048]">
                        {sessionTitle || "Сессия"}
                      </p>
                      {task && (
                        <p className="mt-0.5 truncate text-[11px] text-[#8A7A6A]">
                          {task.completed ? "✅" : "❌"} {task.text.slice(0, 60)}{task.text.length > 60 ? "…" : ""}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-[11px] text-[#B8A898]">
                      {new Date(entry.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!loading && entries.length > 1 && (
          <p className="mb-6 text-center text-[13px] text-[#B8A898]">
            Ты уже {entries.length} раз{entries.length === 1 ? "" : "а"} отмечал(а) настроение — продолжай! 🌱
          </p>
        )}

        {!loading && entries.length === 0 && (
          <div className="rounded-2xl border border-[#E8DDD0] bg-white p-8 text-center shadow-sm">
            <p className="mb-2 text-3xl">🌤️</p>
            <p className="text-[15px] font-medium text-[#5A5048]">Пока нет записей</p>
            <p className="mt-1 text-[13px] text-[#8A7A6A]">Оценивай настроение после каждой сессии — это поможет отслеживать прогресс.</p>
          </div>
        )}
      </div>
    </div>
  );
}

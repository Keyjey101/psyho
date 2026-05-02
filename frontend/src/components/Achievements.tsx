import { useState, useEffect } from "react";
import api from "@/api/client";

interface Achievement {
  id: string;
  title: string;
  description: string;
  emoji: string;
  earned_at: string | null;
  is_locked: boolean;
}

const DEFAULT_ACHIEVEMENTS: Achievement[] = [
  { id: "first_session", title: "Первый шаг", description: "Начал первую сессию", emoji: "🌱", earned_at: null, is_locked: true },
  { id: "sessions_5", title: "На пути", description: "5 завершённых сессий", emoji: "🚀", earned_at: null, is_locked: true },
  { id: "sessions_10", title: "Постоянство", description: "10 сессий позади", emoji: "💎", earned_at: null, is_locked: true },
  { id: "memory_on", title: "Помни меня", description: "Включил долгосрочную память", emoji: "🧠", earned_at: null, is_locked: true },
  { id: "mood_streak_3", title: "Три дня подряд", description: "Отмечал настроение 3 дня", emoji: "🔥", earned_at: null, is_locked: true },
  { id: "exercise_done", title: "Практика", description: "Выполнил первое упражнение", emoji: "✅", earned_at: null, is_locked: true },
  { id: "breathing", title: "Спокойствие", description: "Использовал дыхательные техники", emoji: "🌬️", earned_at: null, is_locked: true },
  { id: "profile_complete", title: "Я — это я", description: "Заполнил профиль", emoji: "🎭", earned_at: null, is_locked: true },
];

export default function Achievements() {
  const [achievements, setAchievements] = useState<Achievement[]>(DEFAULT_ACHIEVEMENTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/achievements")
      .then(({ data }) => {
        if (Array.isArray(data) && data.length > 0) {
          setAchievements(data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const earned = achievements.filter((a) => !a.is_locked && a.earned_at);
  const locked = achievements.filter((a) => a.is_locked || !a.earned_at);

  return (
    <div className="rounded-2xl border border-[#E8DDD0] bg-white p-6 shadow-sm dark:border-[#4A4038] dark:bg-[#352E2A]">
      <h2 className="mb-1 text-lg font-semibold text-[#5A5048] dark:text-[#F5EDE4]">Достижения</h2>
      <p className="mb-4 text-sm text-[#8A7A6A] dark:text-[#B8A898]">
        {loading ? "Загрузка..." : `${earned.length} из ${achievements.length} получено`}
      </p>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {achievements.map((a) => {
          const isEarned = !a.is_locked && a.earned_at;
          return (
            <div
              key={a.id}
              title={isEarned ? `${a.title}: ${a.description}` : `???? — ${a.description}`}
              className={`flex flex-col items-center rounded-xl p-3 text-center transition-all ${
                isEarned
                  ? "bg-[#FAF0E8] border border-[#E8C5A0] dark:bg-[#3E342B] dark:border-[#6A5040]"
                  : "bg-[#F5F5F5] border border-[#EBEBEB] opacity-50 dark:bg-[#2A2420] dark:border-[#3A3028]"
              }`}
            >
              <span className="mb-1 text-2xl">
                {isEarned ? a.emoji : "🔒"}
              </span>
              <p className={`text-[11px] font-medium leading-tight ${isEarned ? "text-[#5A5048] dark:text-[#F5EDE4]" : "text-[#B8A898] dark:text-[#6A5A4A]"}`}>
                {isEarned ? a.title : "???"}
              </p>
              {isEarned && a.earned_at && (
                <p className="mt-0.5 text-[9px] text-[#B8A898] dark:text-[#6A5A4A]">
                  {new Date(a.earned_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

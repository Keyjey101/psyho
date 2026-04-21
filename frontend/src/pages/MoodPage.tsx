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

const MOOD_EMOJIS: Record<number, string> = {
  1: "😫",
  2: "😟",
  3: "😐",
  4: "🙂",
  5: "😊",
};

export default function MoodPage() {
  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/mood").then(({ data }) => setEntries(data)).catch(() => {});
  }, []);

  const avg = entries.length > 0
    ? (entries.reduce((s, e) => s + e.value, 0) / entries.length).toFixed(1)
    : null;

  return (
    <div className="min-h-screen bg-surface-50 p-6 lg:p-10">
      <div className="mx-auto max-w-3xl">
        <button
          onClick={() => navigate("/chat")}
          className="mb-6 flex items-center gap-2 text-sm text-surface-500 hover:text-surface-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад к чату
        </button>

        <h1 className="mb-8 text-2xl font-bold text-surface-900">Трекер настроения</h1>

        {avg && (
          <div className="mb-8 rounded-2xl border border-surface-100 bg-white p-6 shadow-sm">
            <p className="text-sm text-surface-500">Среднее настроение</p>
            <div className="mt-2 flex items-center gap-3">
              <span className="text-4xl">{MOOD_EMOJIS[Math.round(Number(avg))]}</span>
              <span className="text-3xl font-bold text-surface-900">{avg}</span>
              <span className="text-surface-400">из 5</span>
            </div>
          </div>
        )}

        {entries.length > 0 && (
          <div className="mb-8 rounded-2xl border border-surface-100 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-surface-900">История</h2>
            <div className="flex h-32 items-end gap-2">
              {entries.slice().reverse().slice(-20).map((entry) => (
                <div key={entry.id} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-lg">{MOOD_EMOJIS[entry.value]}</span>
                  <div
                    className="w-full rounded-t bg-primary-400 transition-all"
                    style={{ height: `${(entry.value / 5) * 100}%` }}
                  />
                  <span className="text-[10px] text-surface-400">
                    {new Date(entry.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {entries.length === 0 && (
          <div className="rounded-2xl border border-surface-100 bg-white p-8 text-center shadow-sm">
            <p className="text-surface-500">Пока нет записей. Оценивай настроение после каждой сессии!</p>
          </div>
        )}
      </div>
    </div>
  );
}

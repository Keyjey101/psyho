import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import api from "@/api/client";
import { useAuth } from "@/hooks/useAuth";

interface Insight {
  id: string;
  text: string;
  reactions: number;
  created_at: string;
}

const FALLBACK_INSIGHTS: Insight[] = [
  { id: "1", text: "Тревога часто прячется за прокрастинацией. Я начал замечать этот паттерн у себя.", reactions: 47, created_at: new Date().toISOString() },
  { id: "2", text: "После трёх сессий с Никой я наконец смог сформулировать, что именно меня беспокоит.", reactions: 38, created_at: new Date().toISOString() },
  { id: "3", text: "Дыхательное упражнение 4-7-8 помогло мне не сорваться в конфликте с близкими.", reactions: 62, created_at: new Date().toISOString() },
  { id: "4", text: "Оказывается, моя самокритика защищает меня от разочарований — это было открытием.", reactions: 55, created_at: new Date().toISOString() },
];

export default function InsightsFeed() {
  const { isAuthenticated } = useAuth();
  const [insights, setInsights] = useState<Insight[]>(FALLBACK_INSIGHTS);
  const [newInsight, setNewInsight] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [reactedIds, setReactedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.get("/insights")
      .then(({ data }) => {
        if (Array.isArray(data) && data.length > 0) {
          setInsights(data);
        }
      })
      .catch(() => {}); // fallback data shown
  }, []);

  const handleReact = async (id: string) => {
    if (reactedIds.has(id)) return;
    setReactedIds((prev) => new Set([...prev, id]));
    setInsights((prev) => prev.map((ins) => ins.id === id ? { ...ins, reactions: ins.reactions + 1 } : ins));
    try {
      await api.post(`/insights/${id}/react`);
    } catch {
      // ignore — optimistic update already done
    }
  };

  const handleSubmit = async () => {
    if (!newInsight.trim() || newInsight.length > 500) return;
    setSubmitting(true);
    try {
      await api.post("/insights", { text: newInsight.trim() });
      setNewInsight("");
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 3000);
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="insights" className="bg-white px-6 py-16">
      <div className="mx-auto max-w-4xl">
        <h2 className="font-serif text-[22px] font-bold text-[#4A4038] text-center">
          Анонимные инсайты
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-center text-[15px] leading-[1.6] text-[#8A7A6A]">
          Открытия и мысли пользователей Ники — поделись своим
        </p>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {insights.slice(0, 4).map((insight, i) => (
            <motion.div
              key={insight.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="rounded-2xl border border-[#E8DDD0] bg-[#FAF6F1] p-5"
            >
              <p className="text-[14px] leading-relaxed text-[#5A5048] mb-4">
                «{insight.text}»
              </p>
              <div className="flex items-center justify-between">
                <button
                  onClick={() => handleReact(insight.id)}
                  disabled={reactedIds.has(insight.id)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition-all ${
                    reactedIds.has(insight.id)
                      ? "bg-[#FAF0E8] text-[#B8785A]"
                      : "bg-[#F5EDE4] text-[#8A7A6A] hover:bg-[#FAF0E8] hover:text-[#B8785A]"
                  }`}
                >
                  <span>{reactedIds.has(insight.id) ? "❤️" : "🤍"}</span>
                  <span>Тоже про это</span>
                  <span className="font-bold">{insight.reactions}</span>
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Submit form — only for authenticated users */}
        <div className="mt-8 rounded-2xl border border-[#E8DDD0] bg-[#FAF6F1] p-6">
          <h3 className="mb-3 text-[15px] font-semibold text-[#5A5048]">Поделиться своим инсайтом</h3>
          {!isAuthenticated ? (
            <div className="flex flex-col items-center gap-3 py-2 text-center">
              <p className="text-[13px] text-[#8A7A6A]">
                Чтобы поделиться открытием, нужно войти в аккаунт
              </p>
              <Link to="/auth?next=/#insights" className="btn-primary text-sm">
                Войти
              </Link>
            </div>
          ) : submitted ? (
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-700">
              Спасибо! Твой инсайт будет опубликован после проверки.
            </div>
          ) : (
            <>
              <textarea
                value={newInsight}
                onChange={(e) => setNewInsight(e.target.value)}
                placeholder="Поделись открытием, мыслью или тем, что помогло тебе..."
                className="w-full rounded-[14px] border border-[#E8DDD0] bg-white px-4 py-3 text-sm text-[#5A5048] placeholder:text-[#B8A898] focus:border-[#B8785A] focus:outline-none mb-3 resize-none"
                rows={3}
                maxLength={500}
              />
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#B8A898]">{newInsight.length}/500</span>
                <button
                  onClick={handleSubmit}
                  disabled={!newInsight.trim() || submitting}
                  className="btn-primary text-sm"
                >
                  {submitting ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    "Поделиться"
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

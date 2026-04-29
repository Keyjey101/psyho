import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/api/client";
import { ArrowLeft, Lock, Unlock, Plus } from "lucide-react";

interface TimeCapsule {
  id: string;
  content: string | null;
  open_after: string;
  created_at: string;
  opened: boolean;
  is_ready: boolean;
}

const DAYS_OPTIONS = [1, 3, 7, 14, 30];

function countdown(openAfter: string): string {
  const diff = new Date(openAfter).getTime() - Date.now();
  if (diff <= 0) return "Открыта";
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (d > 0) return `${d} д. ${h} ч.`;
  if (h > 0) return `${h} ч. ${m} мин.`;
  return `${m} мин.`;
}

function SkeletonBlock({ h = "h-4", w = "w-full", className = "" }: { h?: string; w?: string; className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-[#E8DDD0] dark:bg-[#4A4038] ${h} ${w} ${className}`} />;
}

export default function TimeCapsulePage() {
  const [capsules, setCapsules] = useState<TimeCapsule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [text, setText] = useState("");
  const [days, setDays] = useState(7);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const fetchCapsules = () => {
    api.get("/capsules")
      .then(({ data }) => setCapsules(Array.isArray(data) ? data : []))
      .catch(() => setCapsules([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCapsules();
  }, []);

  const handleCreate = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await api.post("/capsules", { content: text.trim(), days_until_open: days });
      setText("");
      setDays(7);
      setShowForm(false);
      fetchCapsules();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const sealed = capsules.filter((c) => !c.opened);
  const opened = capsules.filter((c) => c.opened);

  return (
    <div className="min-h-screen bg-[#FAF6F1] p-6 dark:bg-[#2A2420] lg:p-10">
      <div className="mx-auto max-w-2xl">
        <button
          onClick={() => navigate("/chat")}
          className="mb-6 flex items-center gap-2 text-sm text-[#8A7A6A] hover:text-[#5A5048] dark:text-[#B8A898] dark:hover:text-[#F5EDE4]"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад к чату
        </button>

        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#5A5048] dark:text-[#F5EDE4]">Капсула времени</h1>
            <p className="mt-1 text-sm text-[#8A7A6A] dark:text-[#B8A898]">Послания себе в будущем</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 rounded-xl bg-[#B8785A] px-4 py-2 text-sm font-medium text-white hover:bg-[#9A6248]"
          >
            <Plus className="h-4 w-4" />
            Создать
          </button>
        </div>

        {/* Create form */}
        {showForm && (
          <div className="mb-6 rounded-2xl border border-[#B8785A] bg-white p-5 shadow-sm dark:bg-[#352E2A]">
            <h2 className="mb-3 text-[15px] font-semibold text-[#5A5048] dark:text-[#F5EDE4]">Новая капсула</h2>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Напиши послание себе будущему... Что ты сейчас чувствуешь? О чём мечтаешь? Что хочешь вспомнить?"
              className="mb-4 w-full rounded-xl border border-[#E8DDD0] bg-[#FAF6F1] px-3 py-2.5 text-[14px] text-[#5A5048] outline-none focus:border-[#B8785A] min-h-[120px] resize-none dark:border-[#4A4038] dark:bg-[#2A2420] dark:text-[#F5EDE4]"
              maxLength={2000}
            />
            <div className="mb-4">
              <p className="mb-2 text-[13px] font-medium text-[#5A5048] dark:text-[#F5EDE4]">Открыть через:</p>
              <div className="flex flex-wrap gap-2">
                {DAYS_OPTIONS.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDays(d)}
                    className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition-all ${
                      days === d
                        ? "bg-[#B8785A] text-white"
                        : "bg-[#F5EDE4] text-[#5A5048] hover:bg-[#EBD9C8] dark:bg-[#4A4038] dark:text-[#F5EDE4] dark:hover:bg-[#5A5048]"
                    }`}
                  >
                    {d === 1 ? "1 день" : d === 30 ? "1 месяц" : `${d} дней`}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleCreate}
                disabled={!text.trim() || saving}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#B8785A] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#9A6248] disabled:opacity-60"
              >
                {saving ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <><Lock className="h-4 w-4" /> Запечатать</>
                )}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-xl border border-[#E8DDD0] px-4 py-2.5 text-sm text-[#8A7A6A] hover:bg-[#F5EDE4] dark:border-[#4A4038] dark:hover:bg-[#4A4038]"
              >
                Отмена
              </button>
            </div>
          </div>
        )}

        {loading && (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="rounded-2xl border border-[#E8DDD0] bg-white p-5 shadow-sm dark:border-[#4A4038] dark:bg-[#352E2A]">
                <SkeletonBlock h="h-3" w="w-24" className="mb-3" />
                <SkeletonBlock h="h-4" w="w-full" className="mb-2" />
                <SkeletonBlock h="h-3" w="w-1/2" />
              </div>
            ))}
          </div>
        )}

        {!loading && capsules.length === 0 && !showForm && (
          <div className="rounded-2xl border border-[#E8DDD0] bg-white p-8 text-center shadow-sm dark:border-[#4A4038] dark:bg-[#352E2A]">
            <p className="mb-2 text-4xl">⏳</p>
            <p className="text-[15px] font-medium text-[#5A5048] dark:text-[#F5EDE4]">Капсул пока нет</p>
            <p className="mt-1 text-[13px] text-[#8A7A6A] dark:text-[#B8A898]">
              Напиши послание себе будущему — оно откроется через выбранное время
            </p>
          </div>
        )}

        {/* Sealed capsules */}
        {!loading && sealed.length > 0 && (
          <div className="mb-6">
            <h2 className="mb-3 text-[14px] font-semibold text-[#5A5048] dark:text-[#F5EDE4]">Запечатаны</h2>
            <div className="space-y-3">
              {sealed.map((c) => (
                <div key={c.id} className="rounded-2xl border border-[#E8DDD0] bg-white p-5 shadow-sm dark:border-[#4A4038] dark:bg-[#352E2A]">
                  <div className="flex items-center gap-2 mb-2">
                    <Lock className="h-4 w-4 text-[#8A7A6A] dark:text-[#B8A898]" />
                    <span className="text-[13px] font-medium text-[#5A5048] dark:text-[#F5EDE4]">Запечатана</span>
                  </div>
                  <div className="rounded-xl bg-[#FAF6F1] px-4 py-3 text-center dark:bg-[#2A2420]">
                    <p className="text-[12px] text-[#8A7A6A] dark:text-[#B8A898]">Откроется через</p>
                    <p className="text-xl font-bold text-[#B8785A]">{countdown(c.open_after)}</p>
                    <p className="text-[11px] text-[#B8A898]">
                      {new Date(c.open_after).toLocaleDateString("ru-RU", {
                        day: "numeric", month: "long", year: "numeric",
                      })}
                    </p>
                  </div>
                  <p className="mt-2 text-[11px] text-[#B8A898]">
                    Создана {new Date(c.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Opened capsules */}
        {!loading && opened.length > 0 && (
          <div>
            <h2 className="mb-3 text-[14px] font-semibold text-[#5A5048] dark:text-[#F5EDE4]">Открытые послания</h2>
            <div className="space-y-3">
              {opened.map((c) => (
                <div key={c.id} className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 shadow-sm dark:border-emerald-900/30 dark:bg-emerald-950/20">
                  <div className="flex items-center gap-2 mb-3">
                    <Unlock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-[13px] font-medium text-emerald-700 dark:text-emerald-400">Послание от тебя</span>
                    <span className="ml-auto text-[11px] text-emerald-600 dark:text-emerald-500">
                      {new Date(c.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>
                  <p className="text-[14px] leading-relaxed text-[#5A5048] whitespace-pre-wrap dark:text-[#E8D8C8]">
                    {c.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

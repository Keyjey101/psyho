import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/api/client";
import { ArrowLeft, Plus, ChevronDown, ChevronUp } from "lucide-react";

interface DiaryEntry {
  id: string;
  session_id: string | null;
  content: string;
  topics: string[] | null;
  note: string | null;
  created_at: string;
}

function SkeletonBlock({ h = "h-4", w = "w-full", className = "" }: { h?: string; w?: string; className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-[#E8DDD0] ${h} ${w} ${className}`} />;
}

export default function DiaryPage() {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [editingNote, setEditingNote] = useState<{ id: string; text: string } | null>(null);
  const navigate = useNavigate();

  const fetchEntries = () => {
    api.get("/diary")
      .then(({ data }) => setEntries(Array.isArray(data) ? data : []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchEntries();
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await api.post("/diary/generate");
      fetchEntries();
    } catch {
      // ignore — backend may not have this endpoint yet
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveNote = async (id: string, note: string) => {
    try {
      await api.patch(`/diary/${id}`, { note });
      setEntries((prev) => prev.map((e) => e.id === id ? { ...e, note } : e));
      setEditingNote(null);
    } catch {
      // ignore
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => prev === id ? null : id);
  };

  return (
    <div className="min-h-screen bg-[#FAF6F1] dark:bg-[#2A2420] p-6 lg:p-10">
      <div className="mx-auto max-w-2xl">
        <button
          onClick={() => navigate("/chat")}
          className="mb-6 flex items-center gap-2 text-sm text-[#8A7A6A] dark:text-[#B8A898] hover:text-[#5A5048]"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад к чату
        </button>

        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#5A5048] dark:text-[#F5EDE4]">Дневник</h1>
            <p className="mt-1 text-sm text-[#8A7A6A] dark:text-[#B8A898]">Записи на основе твоих сессий</p>
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            {generating ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Создать запись
          </button>
        </div>

        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border border-[#E8DDD0] dark:border-[#4A4038] bg-white dark:bg-[#352E2A] p-5 shadow-sm">
                <SkeletonBlock h="h-3" w="w-24" className="mb-3" />
                <SkeletonBlock h="h-4" w="w-3/4" className="mb-2" />
                <SkeletonBlock h="h-3" w="w-full" className="mb-1" />
                <SkeletonBlock h="h-3" w="w-2/3" />
              </div>
            ))}
          </div>
        )}

        {!loading && entries.length === 0 && (
          <div className="rounded-2xl border border-[#E8DDD0] dark:border-[#4A4038] bg-white dark:bg-[#352E2A] p-8 text-center shadow-sm">
            <p className="mb-2 text-3xl">📓</p>
            <p className="text-[15px] font-medium text-[#5A5048] dark:text-[#F5EDE4]">Дневник пуст</p>
            <p className="mt-1 text-[13px] text-[#8A7A6A] dark:text-[#B8A898]">
              Нажми «Создать запись», чтобы сгенерировать дневниковую запись на основе последней сессии
            </p>
          </div>
        )}

        {!loading && entries.length > 0 && (
          <div className="space-y-4">
            {entries.map((entry) => {
              const isExpanded = expandedId === entry.id;
              const preview = entry.content.slice(0, 200);
              const hasMore = entry.content.length > 200;

              return (
                <div
                  key={entry.id}
                  className="rounded-2xl border border-[#E8DDD0] dark:border-[#4A4038] bg-white dark:bg-[#352E2A] p-5 shadow-sm"
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <span className="text-[11px] text-[#B8A898] dark:text-[#8A7A6A]">
                      {new Date(entry.created_at).toLocaleDateString("ru-RU", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                    {entry.topics && entry.topics.length > 0 && (
                      <div className="flex flex-wrap justify-end gap-1">
                        {entry.topics.slice(0, 3).map((t) => (
                          <span
                            key={t}
                            className="rounded-full bg-[#F5EDE4] dark:bg-[#4A4038] px-2 py-0.5 text-[10px] font-medium text-[#B8785A]"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <p className="text-[14px] leading-relaxed text-[#5A5048] dark:text-[#F5EDE4]">
                    {isExpanded ? entry.content : preview}
                    {!isExpanded && hasMore && "..."}
                  </p>

                  {hasMore && (
                    <button
                      onClick={() => toggleExpand(entry.id)}
                      className="mt-2 flex items-center gap-1 text-[12px] text-[#B8785A] hover:text-[#9A6248]"
                    >
                      {isExpanded ? (
                        <><ChevronUp className="h-3.5 w-3.5" /> Свернуть</>
                      ) : (
                        <><ChevronDown className="h-3.5 w-3.5" /> Читать полностью</>
                      )}
                    </button>
                  )}

                  {/* Note section */}
                  <div className="mt-3 border-t border-[#F0EAE3] pt-3">
                    {editingNote?.id === entry.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={editingNote.text}
                          onChange={(e) => setEditingNote({ id: entry.id, text: e.target.value })}
                          className="input-field min-h-[64px] resize-none text-[13px]"
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
                            className="rounded-lg px-3 py-1.5 text-[12px] text-[#8A7A6A] dark:text-[#B8A898] hover:bg-[#F5EDE4] dark:hover:bg-[#4A4038]"
                          >
                            Отмена
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => setEditingNote({ id: entry.id, text: entry.note || "" })}
                        className="cursor-pointer"
                      >
                        {entry.note ? (
                          <p className="text-[12px] italic text-[#8A7A6A] dark:text-[#B8A898]">{entry.note}</p>
                        ) : (
                          <p className="text-[12px] text-[#B8A898] dark:text-[#8A7A6A] hover:text-[#8A7A6A]">+ Добавить заметку</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

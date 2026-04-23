import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import BreathingExercise from "./BreathingExercise";
import PopItGame from "./PopItGame";
import ActionResultOverlay from "./ActionResultOverlay";
import api from "@/api/client";

interface ActionPanelProps {
  sessionId: string | undefined;
  disabled?: boolean;
}

type ActiveMode = "insight" | "exercise" | "breathe" | "distract" | null;

const CARDS = [
  {
    id: "insight" as const,
    label: "Инсайт",
    desc: "Взгляд со стороны",
    img: "/illustrations/action_insight.png",
    bg: "#FDF5EE",
    accent: "#B8785A",
  },
  {
    id: "exercise" as const,
    label: "Упражнение",
    desc: "Попрактикуемся",
    img: "/illustrations/action_exercise.png",
    bg: "#EEF5F0",
    accent: "#6B9E7A",
  },
  {
    id: "breathe" as const,
    label: "Подышать",
    desc: "Успокоить нервную систему",
    img: "/illustrations/action_breathe.png",
    bg: "#EEF2F8",
    accent: "#6B7E9E",
  },
  {
    id: "distract" as const,
    label: "Отвлечься",
    desc: "Поп-ит для разгрузки",
    img: "/illustrations/action_journal.png",
    bg: "#F5EEF8",
    accent: "#8E6BA8",
  },
];

export default function ActionPanel({ sessionId, disabled }: ActionPanelProps) {
  const [open, setOpen] = useState(false);
  const [activeMode, setActiveMode] = useState<ActiveMode>(null);
  const [overlayTitle, setOverlayTitle] = useState("");
  const [overlayContent, setOverlayContent] = useState<string | null>(null);
  const [overlayLoading, setOverlayLoading] = useState(false);

  const handleCard = async (id: ActiveMode) => {
    if (id === "breathe" || id === "distract") {
      setActiveMode(id);
      setOpen(false);
      return;
    }

    if (id === "insight" || id === "exercise") {
      setOpen(false);
      setOverlayTitle(id === "insight" ? "Инсайт" : "Упражнение");
      setOverlayContent(null);
      setOverlayLoading(true);
      setActiveMode(id);

      try {
        const res = await api.post<{ content: string }>(
          `/sessions/${sessionId}/action`,
          { action_type: id }
        );
        setOverlayContent(res.data.content);
      } catch {
        setOverlayContent("Произошла ошибка. Попробуй ещё раз.");
      } finally {
        setOverlayLoading(false);
      }
    }
  };

  const closeOverlay = () => {
    setActiveMode(null);
    setOverlayContent(null);
  };

  return (
    <>
      {/* Trigger button — shown in InputBar area via Chat.tsx */}
      <button
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#D8CDC0] bg-white text-[#8A7A6A] transition-all hover:bg-[#F5EDE4] disabled:opacity-40 disabled:pointer-events-none"
        title="Действия"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 3L8 13M3 8L13 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>

      {/* Full-screen overlay with card grid */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex flex-col bg-[#FAF6F1]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4">
              <h2 className="text-[17px] font-semibold text-[#5A5048]">Что хочешь сделать?</h2>
              <button
                onClick={() => setOpen(false)}
                className="rounded-full p-2 text-[#8A7A6A] hover:bg-[#E8DDD0]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* 2×2 card grid */}
            <div className="flex flex-1 flex-col items-center justify-center px-5 pb-8">
              <div className="grid w-full max-w-sm grid-cols-2 gap-4">
                {CARDS.map((card) => (
                  <motion.button
                    key={card.id}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleCard(card.id)}
                    className="flex flex-col items-center gap-3 rounded-[24px] p-5 text-center shadow-sm"
                    style={{ background: card.bg }}
                  >
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/70 shadow-sm">
                      <img
                        src={card.img}
                        alt={card.label}
                        className="h-10 w-10 object-contain"
                        loading="eager"
                        onError={(e) => {
                          const img = e.currentTarget;
                          if (!img.dataset.retried) {
                            img.dataset.retried = "1";
                            setTimeout(() => { img.src = card.img + "?" + Date.now(); }, 800);
                          }
                        }}
                      />
                    </div>
                    <div>
                      <p className="text-[15px] font-semibold" style={{ color: card.accent }}>
                        {card.label}
                      </p>
                      <p className="mt-0.5 text-[12px] text-[#8A7A6A]">{card.desc}</p>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Breathing overlay */}
      <AnimatePresence>
        {activeMode === "breathe" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex flex-col bg-[#FAF6F1]"
          >
            <div className="flex items-center justify-between px-5 py-4">
              <h2 className="text-[17px] font-semibold text-[#5A5048]">Дыхание</h2>
              <button
                onClick={closeOverlay}
                className="rounded-full p-2 text-[#8A7A6A] hover:bg-[#E8DDD0]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-1 items-center justify-center">
              <BreathingExercise />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pop-it overlay */}
      <AnimatePresence>
        {activeMode === "distract" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex flex-col bg-[#FAF6F1]"
          >
            <div className="flex items-center justify-between px-5 py-4">
              <h2 className="text-[17px] font-semibold text-[#5A5048]">Отвлечься</h2>
              <button
                onClick={closeOverlay}
                className="rounded-full p-2 text-[#8A7A6A] hover:bg-[#E8DDD0]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-1 items-center justify-center">
              <PopItGame />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Insight / Exercise result overlay */}
      {(activeMode === "insight" || activeMode === "exercise") && (
        <ActionResultOverlay
          title={overlayTitle}
          content={overlayContent}
          isLoading={overlayLoading}
          onClose={closeOverlay}
        />
      )}
    </>
  );
}

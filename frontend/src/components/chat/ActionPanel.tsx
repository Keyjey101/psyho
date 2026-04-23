import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronUp, ChevronDown } from "lucide-react";
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
    img: "/illustrations/opt/action_insight.webp",
    bg: "#FDF5EE",
    accent: "#B8785A",
  },
  {
    id: "exercise" as const,
    label: "Упражнение",
    desc: "Попрактикуемся",
    img: "/illustrations/opt/action_exercise.webp",
    bg: "#EEF5F0",
    accent: "#6B9E7A",
  },
  {
    id: "breathe" as const,
    label: "Подышать",
    desc: "Успокоить нервную систему",
    img: "/illustrations/opt/action_breathe.webp",
    bg: "#EEF2F8",
    accent: "#6B7E9E",
  },
  {
    id: "distract" as const,
    label: "Отвлечься",
    desc: "Поп-ит для разгрузки",
    img: "/illustrations/opt/action_journal.webp",
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
      {/* Trigger button */}
      <button
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#D8CDC0] bg-white text-[#8A7A6A] transition-all hover:bg-[#F5EDE4] disabled:opacity-40 disabled:pointer-events-none"
        title="Действия"
      >
        <ChevronUp className="h-5 w-5" />
      </button>

      {/* Full-screen action grid — slides up from bottom */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-0 z-40 flex flex-col bg-[#FAF6F1]"
          >
            {/* Card grid */}
            <div className="flex flex-1 flex-col items-center justify-center px-5 py-6">
              <div className="grid w-full max-w-md grid-cols-2 gap-5">
                {CARDS.map((card) => (
                  <motion.button
                    key={card.id}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleCard(card.id)}
                    className="flex flex-col items-center gap-4 rounded-[24px] p-6 text-center shadow-sm"
                    style={{ background: card.bg }}
                  >
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/70 shadow-sm">
                      <img
                        src={card.img}
                        alt={card.label}
                        className="h-14 w-14 object-contain"
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
                      <p className="text-[16px] font-semibold" style={{ color: card.accent }}>
                        {card.label}
                      </p>
                      <p className="mt-0.5 text-[13px] text-[#8A7A6A]">{card.desc}</p>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Bottom bar — mirrors InputBar layout, closes panel */}
            <div
              className="border-t border-[#E8DDD0] bg-white px-4 py-3 lg:px-6"
              style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
            >
              <div className="mx-auto flex max-w-3xl items-center gap-2">
                <button
                  onClick={() => setOpen(false)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#D8CDC0] bg-white text-[#8A7A6A] hover:bg-[#F5EDE4]"
                >
                  <ChevronDown className="h-5 w-5" />
                </button>
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
                <ChevronDown className="h-5 w-5" />
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
                <ChevronDown className="h-5 w-5" />
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

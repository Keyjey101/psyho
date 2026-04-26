import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import BreathingExercise from "./BreathingExercise";
import PopItGame from "./PopItGame";
import ActionResultOverlay from "./ActionResultOverlay";
import api from "@/api/client";

interface ActionPanelProps {
  sessionId: string | undefined;
  disabled?: boolean;
  isOpen: boolean;
  onMoodRequest?: () => void;
}

type ActiveMode = "insight" | "exercise" | "breathe" | "distract" | null;

const CARDS = [
  { id: "breathe" as const, emoji: "\uD83E\uDE81", label: "Подышать" },
  { id: "insight" as const, emoji: "\uD83D\uDCA1", label: "Инсайт" },
  { id: "exercise" as const, emoji: "\uD83C\uDFCB\uFE0F", label: "Упражнение" },
  { id: "distract" as const, emoji: "\uD83C\uDFAE", label: "Поп-ит" },
];

export default function ActionPanel({ sessionId, disabled, isOpen, onMoodRequest }: ActionPanelProps) {
  const [activeMode, setActiveMode] = useState<ActiveMode>(null);
  const [overlayTitle, setOverlayTitle] = useState("");
  const [overlayContent, setOverlayContent] = useState<string | null>(null);
  const [overlayLoading, setOverlayLoading] = useState(false);

  const closeBreatheOverlay = () => {
    setActiveMode(null);
    onMoodRequest?.();
  };

  const handleAction = async (id: ActiveMode) => {
    if (id === "breathe" || id === "distract") {
      setActiveMode(id);
      return;
    }

    if (id === "insight" || id === "exercise") {
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
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
            className="overflow-hidden border-t border-[#E8DDD0]"
          >
            <div className="flex gap-2 px-4 py-3 bg-[#FAF6F1]">
              {CARDS.map((card) => (
                <button
                  key={card.id}
                  disabled={disabled}
                  onClick={() => handleAction(card.id)}
                  className="flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-xl
                             bg-white/60 hover:bg-white active:scale-95 transition-all
                             text-xs text-[#5A5048] font-medium disabled:opacity-40 disabled:pointer-events-none"
                >
                  <span className="text-lg leading-none">{card.emoji}</span>
                  <span>{card.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                onClick={closeBreatheOverlay}
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

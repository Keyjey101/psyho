import { useState } from "react";
import { MessageCircle, Brain, Heart } from "lucide-react";

type Mode = "free" | "structured" | "crisis";

const MODES: { id: Mode; label: string; icon: React.ElementType; desc: string }[] = [
  { id: "free", label: "Свободный разговор", icon: MessageCircle, desc: "Обычный диалог с терапевтом" },
  { id: "structured", label: "Структурированная сессия", icon: Brain, desc: "Пошаговая работа с техниками" },
  { id: "crisis", label: "Кризисная поддержка", icon: Heart, desc: "Экстренная помощь и заземление" },
];

interface ConversationModeProps {
  currentMode: Mode;
  onModeChange: (mode: Mode) => void;
}

export default function ConversationMode({ currentMode, onModeChange }: ConversationModeProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg border border-surface-200 bg-white px-3 py-1.5 text-xs font-medium text-surface-600 transition-colors hover:bg-surface-50"
      >
        {MODES.find((m) => m.id === currentMode)?.label || "Режим"}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-surface-200 bg-white p-2 shadow-lg">
            {MODES.map((mode) => (
              <button
                key={mode.id}
                onClick={() => { onModeChange(mode.id); setIsOpen(false); }}
                className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                  currentMode === mode.id ? "bg-primary-50" : "hover:bg-surface-50"
                }`}
              >
                <mode.icon className={`mt-0.5 h-4 w-4 shrink-0 ${currentMode === mode.id ? "text-primary-600" : "text-surface-400"}`} />
                <div>
                  <p className={`text-sm font-medium ${currentMode === mode.id ? "text-primary-700" : "text-surface-900"}`}>
                    {mode.label}
                  </p>
                  <p className="text-xs text-surface-500">{mode.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

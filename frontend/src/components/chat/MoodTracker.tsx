import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const MOODS = [
  { emoji: "😫", value: 1, label: "Ужасно" },
  { emoji: "😟", value: 2, label: "Плохо" },
  { emoji: "😐", value: 3, label: "Нормально" },
  { emoji: "🙂", value: 4, label: "Хорошо" },
  { emoji: "😊", value: 5, label: "Отлично" },
];

interface MoodTrackerProps {
  onSubmit: (value: number) => void;
  onSkip: () => void;
}

export default function MoodTracker({ onSubmit, onSkip }: MoodTrackerProps) {
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="mx-auto max-w-md rounded-2xl border border-surface-100 bg-white p-6 shadow-sm"
      >
        <h3 className="mb-2 text-center text-lg font-semibold text-surface-900">
          Как ты себя чувствуешь после сессии?
        </h3>
        <p className="mb-6 text-center text-sm text-surface-500">
          Это поможет отследить твой прогресс
        </p>

        <div className="mb-6 flex justify-center gap-3">
          {MOODS.map((mood) => (
            <button
              key={mood.value}
              onClick={() => setSelected(mood.value)}
              className={`flex flex-col items-center gap-1 rounded-xl px-3 py-2 transition-all ${
                selected === mood.value
                  ? "bg-primary-50 ring-2 ring-primary-400"
                  : "hover:bg-surface-50"
              }`}
            >
              <span className="text-2xl">{mood.emoji}</span>
              <span className="text-xs text-surface-500">{mood.label}</span>
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button onClick={onSkip} className="btn-secondary flex-1">
            Пропустить
          </button>
          <button
            onClick={() => selected && onSubmit(selected)}
            disabled={!selected}
            className="btn-primary flex-1"
          >
            Оценить
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

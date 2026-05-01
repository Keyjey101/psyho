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
        className="mx-auto max-w-md rounded-2xl border border-[#E8DDD0] bg-white p-6 shadow-sm dark:border-[#4A4038] dark:bg-[#352E2A]"
      >
        <h3 className="mb-2 text-center text-lg font-semibold text-[#5A5048] dark:text-[#F5EDE4]">
          Как ты себя чувствуешь после сессии?
        </h3>
        <p className="mb-6 text-center text-sm text-[#8A7A6A] dark:text-[#B8A898]">
          Это поможет отследить твой прогресс
        </p>

        <div className="mb-6 flex justify-center gap-3">
          {MOODS.map((mood) => (
            <button
              key={mood.value}
              onClick={() => setSelected(mood.value)}
              className={`flex flex-col items-center gap-1 rounded-xl px-3 py-2 transition-all ${
                selected === mood.value
                  ? "bg-[#FAF0E8] ring-2 ring-[#B8785A] dark:bg-[#3E342B]"
                  : "hover:bg-[#FAF6F1] dark:hover:bg-[#2A2420]"
              }`}
            >
              <span className="text-2xl">{mood.emoji}</span>
              <span className="text-xs text-[#8A7A6A] dark:text-[#B8A898]">{mood.label}</span>
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onSkip}
            className="flex-1 rounded-full border border-[#D8CDC0] px-4 py-2.5 text-sm font-medium text-[#8A7A6A] transition-colors hover:bg-[#FAF6F1] dark:border-[#4A4038] dark:text-[#B8A898] dark:hover:bg-[#2A2420]"
          >
            Пропустить
          </button>
          <button
            onClick={() => selected && onSubmit(selected)}
            disabled={!selected}
            className="flex-1 rounded-full bg-[#B8785A] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#9E6349] disabled:opacity-50"
          >
            Оценить
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

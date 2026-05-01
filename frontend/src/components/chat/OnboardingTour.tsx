import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, MessageSquare, Brain, Sparkles } from "lucide-react";

const STEPS = [
  {
    icon: MessageSquare,
    title: "Расскажи, что чувствуешь",
    description: "Просто напиши, что тебя беспокоит. Не нужно формулировать правильно — Ника поймёт.",
  },
  {
    icon: Brain,
    title: "ИИ подберёт подход",
    description: "Система автоматически подключит нужных специалистов. Ты увидишь их бейджи под ответом.",
  },
  {
    icon: Sparkles,
    title: "Исследуй и развивайся",
    description: "Задавай вопросы, проси техники, делись переживаниями. Ника всегда рядом.",
  },
];

export default function OnboardingTour({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onComplete();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onComplete]);

  const StepIcon = STEPS[step].icon;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="relative w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl dark:bg-[#352E2A]"
        >
          <button
            onClick={onComplete}
            className="absolute right-4 top-4 rounded-lg p-1 text-surface-400 hover:bg-surface-100 dark:text-[#B8A898] dark:hover:bg-[#4A4038]"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-100 dark:bg-[#3E342B]">
              <StepIcon className="h-8 w-8 text-primary-600 dark:text-[#C08B68]" />
            </div>
            <h2 className="mb-2 text-xl font-bold text-surface-900 dark:text-[#F5EDE4]">{STEPS[step].title}</h2>
            <p className="text-surface-500 dark:text-[#B8A898]">{STEPS[step].description}</p>
          </div>

          <div className="mb-6 flex justify-center gap-2">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-2 rounded-full transition-all ${
                  i === step ? "w-8 bg-primary-500" : "w-2 bg-surface-200"
                }`}
              />
            ))}
          </div>

          <div className="flex gap-3">
            {step > 0 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="btn-secondary flex-1"
              >
                Назад
              </button>
            )}
            <button
              onClick={() => {
                if (step < STEPS.length - 1) {
                  setStep((s) => s + 1);
                } else {
                  onComplete();
                }
              }}
              className="btn-primary flex-1"
            >
              {step < STEPS.length - 1 ? (
                <>Далее <ChevronRight className="h-4 w-4" /></>
              ) : (
                "Начать!"
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

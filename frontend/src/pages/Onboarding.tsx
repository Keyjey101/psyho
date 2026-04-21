import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/api/client";
import { Target, ArrowRight } from "lucide-react";

const GOALS = [
  { id: "anxiety", label: "Справиться с тревогой", emoji: "😰" },
  { id: "depression", label: "Преодолеть подавленность", emoji: "🌧️" },
  { id: "relationships", label: "Улучшить отношения", emoji: "💑" },
  { id: "self_esteem", label: "Повысить самооценку", emoji: "💪" },
  { id: "meaning", label: "Найти смысл и цель", emoji: "🌟" },
  { id: "stress", label: "Управлять стрессом", emoji: "🧘" },
  { id: "habits", label: "Изменить привычки", emoji: "🔄" },
  { id: "trauma", label: "Переработать травму", emoji: "🩹" },
];

const STYLES = [
  { id: "direct", label: "Прямой и структурированный", desc: "Чёткие шаги, конкретные техники" },
  { id: "gentle", label: "Мягкий и поддерживающий", desc: "Больше эмпатии, меньше директив" },
  { id: "balanced", label: "Сбалансированный", desc: "Золотая середина" },
];

export default function Onboarding() {
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [style, setStyle] = useState("balanced");
  const [step, setStep] = useState(0);
  const navigate = useNavigate();

  const toggleGoal = (id: string) => {
    setSelectedGoals((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  };

  const handleFinish = async () => {
    try {
      await api.patch("/user/me", {
        therapy_goals: selectedGoals.join(", "),
        preferred_style: style,
      });
    } catch {}
    navigate("/chat");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-primary-50 to-white px-6">
      <div className="w-full max-w-lg">
        {step === 0 && (
          <div className="text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-100">
              <Target className="h-8 w-8 text-primary-600" />
            </div>
            <h1 className="mb-3 text-2xl font-bold text-surface-900">
              Что тебя привело сюда?
            </h1>
            <p className="mb-8 text-surface-500">
              Выбери одну или несколько целей — это поможет нам подобрать подход
            </p>
            <div className="grid grid-cols-2 gap-3 mb-8">
              {GOALS.map((goal) => (
                <button
                  key={goal.id}
                  onClick={() => toggleGoal(goal.id)}
                  className={`rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                    selectedGoals.includes(goal.id)
                      ? "border-primary-400 bg-primary-50 text-primary-700"
                      : "border-surface-200 bg-white text-surface-700 hover:border-surface-300"
                  }`}
                >
                  <span className="mr-2">{goal.emoji}</span>
                  {goal.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setStep(1)}
              disabled={selectedGoals.length === 0}
              className="btn-primary w-full"
            >
              Далее <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="text-center">
            <h1 className="mb-3 text-2xl font-bold text-surface-900">
              Какой стиль общения тебе ближе?
            </h1>
            <p className="mb-8 text-surface-500">
              Это можно изменить позже в настройках
            </p>
            <div className="space-y-3 mb-8">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  className={`w-full rounded-xl border px-6 py-4 text-left transition-all ${
                    style === s.id
                      ? "border-primary-400 bg-primary-50"
                      : "border-surface-200 bg-white hover:border-surface-300"
                  }`}
                >
                  <p className={`font-medium ${style === s.id ? "text-primary-700" : "text-surface-900"}`}>
                    {s.label}
                  </p>
                  <p className="mt-1 text-sm text-surface-500">{s.desc}</p>
                </button>
              ))}
            </div>
            <button onClick={handleFinish} className="btn-primary w-full">
              Начать разговор <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

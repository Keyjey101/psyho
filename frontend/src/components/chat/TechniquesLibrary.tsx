import { useState } from "react";
import { Sparkles, X, ChevronRight } from "lucide-react";

interface Technique {
  title: string;
  description: string;
  duration: string;
  category: string;
}

const TECHNIQUES: Technique[] = [
  { title: "Дыхание 4-7-8", description: "Вдох на 4 счёта, задержка на 7, выдох на 8. Успокаивает нервную систему.", duration: "3 мин", category: "Соматика" },
  { title: "5-4-3-2-1 Заземление", description: "Найди 5 вещей глазами, 4 на ощупь, 3 на слух, 2 на запах, 1 на вкус.", duration: "5 мин", category: "Соматика" },
  { title: "Когнитивная реструктуризация", description: "Запиши автоматическую мысль, найди искажение, предложи альтернативу.", duration: "10 мин", category: "КПТ" },
  { title: "Дневник мыслей", description: "Ситуация → Эмоция → Мысль → Альтернатива. Шаблон для анализа.", duration: "15 мин", category: "КПТ" },
  { title: "Ценности и действия", description: "Определи 3 важные ценности и одно маленькое действие на сегодня.", duration: "10 мин", category: "ACT" },
  { title: "Диалог с частью", description: "Представь внутреннюю часть. Спроси: чего ты боишься? Чего хочешь?", duration: "15 мин", category: "IFS" },
  { title: "Нарративная карта", description: "Нарисуй карту доминирующей истории и найди исключения.", duration: "20 мин", category: "Нарративная" },
  { title: "Сканирование тела", description: "Пройдись вниманием от макушки до пальцев ног. Замечай ощущения.", duration: "10 мин", category: "Соматика" },
];

export default function TechniquesLibrary() {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="btn-secondary w-full text-sm"
      >
        <Sparkles className="h-4 w-4" />
        Библиотека техник
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white dark:bg-[#352E2A] p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-surface-900 dark:text-[#F5EDE4]">Техники и упражнения</h3>
          <button onClick={() => setIsOpen(false)} className="rounded-lg p-1 text-surface-400 hover:bg-surface-100 dark:text-[#B8A898] dark:hover:bg-[#4A4038]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          {TECHNIQUES.map((tech, i) => (
            <button
              key={i}
              onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
              className="w-full rounded-xl border border-surface-200 dark:border-[#4A4038] p-4 text-left transition-all hover:border-surface-300 dark:hover:border-[#5A5048]"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="mb-1 inline-block rounded-full bg-primary-50 dark:bg-[#3E342B] px-2 py-0.5 text-xs font-medium text-primary-600 dark:text-[#C08B68]">
                    {tech.category}
                  </span>
                  <h4 className="mt-1 font-medium text-surface-900 dark:text-[#F5EDE4]">{tech.title}</h4>
                </div>
                <span className="text-xs text-surface-400 dark:text-[#8A7A6A]">{tech.duration}</span>
              </div>
              {expandedIdx === i && (
                <p className="mt-2 text-sm leading-relaxed text-surface-600 dark:text-[#B8A898]">{tech.description}</p>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

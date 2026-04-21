import { motion } from "framer-motion";
import { MessageCircle, Brain, Heart } from "lucide-react";

const steps = [
  {
    icon: MessageCircle,
    step: "01",
    title: "Опиши, что тебя беспокоит",
    description: "Просто напиши, что чувствуешь или что происходит. Не нужно формулировать «правильно» — мы услышим.",
  },
  {
    icon: Brain,
    step: "02",
    title: "ИИ подберёт подход",
    description: "Система проанализирует контекст и подключит 1-2 релевантных специалиста. Ты даже не заметишь переключения.",
  },
  {
    icon: Heart,
    step: "03",
    title: "Исследуй вместе",
    description: "Оркестратор синтезирует единый тёплый ответ. Ты общаешься с одним «терапевтом», за которым стоит команда.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16 text-center"
        >
          <h2 className="mb-4 text-3xl font-bold text-surface-900 sm:text-4xl">
            Как это работает
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-surface-500">
            Три простых шага от беспокойства к пониманию
          </p>
        </motion.div>

        <div className="relative">
          <div className="absolute left-1/2 top-0 hidden h-full w-px -translate-x-1/2 bg-gradient-to-b from-primary-200 via-primary-300 to-primary-200 lg:block" />

          <div className="space-y-16 lg:space-y-24">
            {steps.map((step, i) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className={`flex flex-col items-center gap-6 lg:flex-row ${
                  i % 2 === 1 ? "lg:flex-row-reverse" : ""
                }`}
              >
                <div className={`flex-1 ${i % 2 === 1 ? "lg:text-left" : "lg:text-right"}`}>
                  <div className={`glass-card inline-block p-6 text-left`}>
                    <div className="mb-3 text-xs font-bold uppercase tracking-wider text-primary-500">
                      Шаг {step.step}
                    </div>
                    <h3 className="mb-2 text-xl font-bold text-surface-900">{step.title}</h3>
                    <p className="text-surface-600 leading-relaxed">{step.description}</p>
                  </div>
                </div>

                <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-lg">
                  <step.icon className="h-7 w-7" />
                </div>

                <div className="flex-1 hidden lg:block" />
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

import { motion } from "framer-motion";
import { Brain, Users, Shield, Clock } from "lucide-react";

const features = [
  {
    icon: Brain,
    title: "Интеллектуальный подбор",
    description: "ИИ автоматически определяет, какой терапевтический подход лучше подходит к твоей ситуации",
    color: "from-primary-500 to-primary-600",
  },
  {
    icon: Users,
    title: "Мультиагентная система",
    description: "6 специалистов работают вместе — КПТ, Юнг, ACT, IFS, нарративная и соматическая терапия",
    color: "from-purple-500 to-purple-600",
  },
  {
    icon: Shield,
    title: "Безопасность",
    description: "Твои данные защищены шифрованием. Мы не передаём информацию третьим лицам",
    color: "from-emerald-500 to-emerald-600",
  },
  {
    icon: Clock,
    title: "Всегда рядом",
    description: "Доступно 24/7 — тогда, когда тебе это нужно. Без ожидания и очередей",
    color: "from-warm-500 to-warm-600",
  },
];

export default function Features() {
  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16 text-center"
        >
          <h2 className="mb-4 text-3xl font-bold text-surface-900 sm:text-4xl">
            Почему PsyHo?
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-surface-500">
            Технологии, которые делают терапию доступнее, бережнее и умнее
          </p>
        </motion.div>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="group glass-card p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
            >
              <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${feature.color} text-white shadow-lg`}>
                <feature.icon className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-surface-900">
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed text-surface-500">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

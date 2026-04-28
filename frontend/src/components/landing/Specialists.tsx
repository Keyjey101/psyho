import { motion } from "framer-motion";

const specialists = [
  {
    emoji: "🧠",
    name: "КПТ-терапевт",
    school: "Когнитивно-поведенческая терапия",
    description: "Работает с автоматическими мыслями и когнитивными искажениями. Помогает при тревоге, депрессии, прокрастинации.",
    color: "bg-blue-50 border-blue-100",
    textColor: "text-blue-700",
  },
  {
    emoji: "🌙",
    name: "Юнгианский аналитик",
    school: "Аналитическая психология Юнга",
    description: "Исследует сны, символы, архетипы и теневые аспекты личности. Помогает найти глубинный смысл.",
    color: "bg-purple-50 border-purple-100",
    textColor: "text-purple-700",
  },
  {
    emoji: "🧭",
    name: "ACT-терапевт",
    school: "Терапия принятия и ответственности",
    description: "Учит принимать сложные чувства и действовать в соответствии с ценностями. Для борьбы с избеганием.",
    color: "bg-emerald-50 border-emerald-100",
    textColor: "text-emerald-700",
  },
  {
    emoji: "🎭",
    icon: "/illustrations/opt/method_ifs.webp",
    name: "IFS-терапевт",
    school: "Внутренние семейные системы",
    description: "Исследует внутренние части личности и помогает наладить диалог между ними. Для внутренних конфликтов.",
    color: "bg-amber-50 border-amber-100",
    textColor: "text-amber-700",
  },
  {
    emoji: "📖",
    name: "Нарративный терапевт",
    school: "Нарративная терапия",
    description: "Помогает переписать ограничивающие истории о себе. Работа с идентичностью и смыслом опыта.",
    color: "bg-rose-50 border-rose-100",
    textColor: "text-rose-700",
  },
  {
    emoji: "🌿",
    name: "Соматический терапевт",
    school: "Соматика + майндфулнесс",
    description: "Работает с телесными проявлениями стресса. Заземление, дыхание, осознанность здесь и сейчас.",
    color: "bg-teal-50 border-teal-100",
    textColor: "text-teal-700",
  },
];

export default function Specialists() {
  return (
    <section className="px-6 py-24 bg-gradient-to-b from-white to-surface-50">
      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16 text-center"
        >
          <h2 className="mb-4 text-3xl font-bold text-surface-900 sm:text-4xl">
            Твоя команда специалистов
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-surface-500">
            6 терапевтических подходов в одном чате. ИИ автоматически подключает нужных экспертов.
          </p>
        </motion.div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {specialists.map((spec, i) => (
            <motion.div
              key={spec.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className={`group rounded-2xl border p-6 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${spec.color}`}
            >
              <div className="mb-4">
                {"icon" in spec && spec.icon
                  ? <img src={spec.icon as string} alt={spec.name} className="h-10 w-10 object-contain" />
                  : <span className="text-4xl">{spec.emoji}</span>
                }
              </div>
              <h3 className="mb-1 text-lg font-bold text-surface-900">{spec.name}</h3>
              <p className={`mb-3 text-sm font-medium ${spec.textColor}`}>{spec.school}</p>
              <p className="text-sm leading-relaxed text-surface-600">{spec.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

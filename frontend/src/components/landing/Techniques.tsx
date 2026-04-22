import { motion } from "framer-motion";

const techniques = [
  {
    emoji: "🧠",
    name: "Когнитивно-поведенческая терапия",
    shortName: "КПТ",
    description: "Работа с мыслями, которые мешают жить",
  },
  {
    emoji: "🌙",
    name: "Юнгианский анализ",
    shortName: "Юнг",
    description: "Понимание глубинных слоёв личности и снов",
  },
  {
    emoji: "🧭",
    name: "Терапия принятия и ответственности",
    shortName: "ACT",
    description: "Действовать по ценностям, не убегая от чувств",
  },
  {
    emoji: "🎭",
    name: "Системная семейная терапия",
    shortName: "IFS",
    description: "Примирение внутренних частей личности",
  },
  {
    emoji: "📖",
    name: "Нарративная терапия",
    shortName: "Нарратив",
    description: "Переписать историю о себе по-новому",
  },
  {
    emoji: "🌿",
    name: "Соматическая терапия",
    shortName: "Соматика",
    description: "Телесное осознание и работа с напряжением",
  },
];

export default function Techniques() {
  return (
    <section className="bg-white px-6 py-16">
      <div className="mx-auto max-w-4xl">
        <h2 className="font-serif text-[22px] font-bold text-[#4A4038] text-center">
          Какими подходами я владею
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-center text-[15px] leading-[1.6] text-[#8A7A6A]">
          Я умею работать с тревогой, отношениями, самопознанием и многим другим — подберу подход
          именно под тебя
        </p>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {techniques.map((t, i) => (
            <motion.div
              key={t.shortName}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="rounded-2xl border border-[#E8DDD0] bg-white p-5 transition-all duration-300 hover:border-[#D8CDC0] hover:bg-[#FAF6F1]"
              style={{ boxShadow: "0 2px 12px rgba(90,80,72,0.06)" }}
            >
              <div className="text-[32px]">{t.emoji}</div>
              <h4 className="mt-3 font-serif text-[16px] font-semibold text-[#5A5048]">
                {t.shortName}
              </h4>
              <p className="mt-1 text-[13px] leading-[1.5] text-[#8A7A6A]">{t.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

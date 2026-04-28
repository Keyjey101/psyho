import { motion } from "framer-motion";

const pipeline = [
  { icon: "💬", label: "Твоё сообщение", desc: "Пишешь как другу" },
  { icon: "🔍", label: "Анализ темы", desc: "Что за этим стоит?" },
  { icon: "🎯", label: "Выбор специалистов", desc: "1–2 из 6 экспертов" },
  { icon: "⚡", label: "Параллельный анализ", desc: "Каждый со своей стороны" },
  { icon: "🔮", label: "Синтез ответа", desc: "Взгляды объединяются" },
  { icon: "🌸", label: "Ника отвечает", desc: "Глубоко и точно" },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

const arrowVariants = {
  hidden: { opacity: 0, scaleX: 0 },
  visible: { opacity: 1, scaleX: 1, transition: { duration: 0.2 } },
};

export default function AgentSystem() {
  return (
    <section className="bg-white px-6 py-16">
      <div className="mx-auto max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="text-center"
        >
          <h2 className="font-serif text-[22px] font-bold text-[#4A4038]">
            Не просто чат — команда из 6 специалистов
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-[1.7] text-[#8A7A6A]">
            ChatGPT и другие ИИ-ассистенты отвечают с одной точки зрения. Ника по-другому:
            за каждым ответом — совет сразу нескольких терапевтических подходов,
            собранный в одно тёплое и точное послание. Ты видишь Нику — за ней стоит команда.
          </p>
        </motion.div>

        {/* Animated pipeline */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mt-10 rounded-2xl border border-[#E8DDD0] bg-[#FAF6F1] p-6"
        >
          <p className="mb-6 text-center text-[12px] font-medium uppercase tracking-wider text-[#B8A898]">
            Что происходит за каждым ответом
          </p>

          {/* Desktop: horizontal */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="hidden items-start justify-center gap-0 sm:flex"
          >
            {pipeline.map((step, i) => (
              <div key={step.label} className="flex items-start">
                <motion.div
                  variants={itemVariants}
                  className="flex w-[90px] flex-col items-center gap-2 text-center"
                >
                  <motion.div
                    animate={i === pipeline.length - 1 ? { scale: [1, 1.12, 1] } : {}}
                    transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 2 }}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[22px] shadow-sm border border-[#E8DDD0]"
                  >
                    {step.icon}
                  </motion.div>
                  <p className="text-[11px] font-semibold leading-tight text-[#5A5048]">{step.label}</p>
                  <p className="text-[10px] leading-tight text-[#B8A898]">{step.desc}</p>
                </motion.div>
                {i < pipeline.length - 1 && (
                  <motion.div
                    variants={arrowVariants}
                    className="mt-[18px] flex items-center px-1 origin-left"
                  >
                    <div className="h-px w-5 bg-[#D8CDC0]" />
                    <div className="border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[6px] border-l-[#D8CDC0]" />
                  </motion.div>
                )}
              </div>
            ))}
          </motion.div>

          {/* Mobile: vertical */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="flex flex-col gap-3 sm:hidden"
          >
            {pipeline.map((step, i) => (
              <div key={step.label}>
                <motion.div
                  variants={itemVariants}
                  className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm border border-[#E8DDD0]"
                >
                  <span className="text-[20px]">{step.icon}</span>
                  <div>
                    <p className="text-[13px] font-semibold text-[#5A5048]">{step.label}</p>
                    <p className="text-[11px] text-[#B8A898]">{step.desc}</p>
                  </div>
                </motion.div>
                {i < pipeline.length - 1 && (
                  <motion.div variants={arrowVariants} className="flex justify-center py-1">
                    <span className="text-[#D8CDC0]">↓</span>
                  </motion.div>
                )}
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* Key insight */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="mt-6 rounded-2xl border border-[#E8DDD0] bg-[#FDF5EE] p-6"
        >
          <p className="text-[15px] leading-[1.7] text-[#5A5048]">
            <span className="font-semibold text-[#B8785A]">Чем это отличается от ChatGPT?</span>{" "}
            Обычный ИИ-помощник — один голос, одна логика. Ника собирает взгляды
            сразу нескольких терапевтических школ: КПТ, юнгианский анализ, ACT, IFS,
            нарративная и соматическая терапия. Каждый эксперт добавляет своё — ты получаешь
            ответ, который одновременно глубже, точнее и человечнее.
          </p>
          <p className="mt-3 text-[14px] leading-[1.6] text-[#8A7A6A]">
            Под каждым ответом Ника показывает эмодзи подходов{" "}
            <span className="font-medium">🧠 🌿</span> — ты всегда видишь,
            кто именно помогал в этот раз.
          </p>
        </motion.div>

        {/* Feedback */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="mt-6 text-center text-[13px] text-[#B8A898]"
        >
          Есть идеи или предложения как улучшить ваш опыт?{" "}
          <a
            href="https://t.me/keyjey101"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-[#B8785A] hover:underline"
          >
            Пишите @keyjey101
          </a>
        </motion.p>
      </div>
    </section>
  );
}

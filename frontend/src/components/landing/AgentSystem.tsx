import { motion } from "framer-motion";

const pipeline = [
  "Твоё сообщение",
  "Анализ темы",
  "Выбор 1–2 агентов",
  "Параллельный анализ",
  "Синтез ответа",
  "Ника отвечает",
];

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
            Не просто чат-бот — команда из 6 специалистов
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-[1.7] text-[#8A7A6A]">
            Когда ты пишешь Нике, за кулисами работает мультиагентная система. Оркестратор
            анализирует тему, параллельно вызывает 1–2 специализированных агента — каждый
            эксперт в своём терапевтическом подходе — и синтезирует их взгляды в один
            тёплый ответ. Ты видишь только Нику, но за ней стоит целая команда.
          </p>
        </motion.div>

        {/* Pipeline flow */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mt-10 rounded-2xl border border-[#E8DDD0] bg-[#FAF6F1] p-5"
        >
          <p className="mb-4 text-center text-[12px] font-medium uppercase tracking-wider text-[#B8A898]">
            Как обрабатывается каждое сообщение
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {pipeline.map((step, i) => (
              <div key={step} className="flex items-center gap-2">
                <span className="rounded-full bg-white px-3 py-1.5 text-[13px] text-[#5A5048] shadow-sm border border-[#E8DDD0]">
                  {step}
                </span>
                {i < pipeline.length - 1 && (
                  <span className="text-[#B8A898] text-sm">→</span>
                )}
              </div>
            ))}
          </div>
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
            <span className="font-semibold text-[#B8785A]">Обычный AI-чат отвечает одним голосом.</span>{" "}
            Ника собирает консенсус нескольких терапевтических перспектив — это принципиально
            глубже и точнее, чем один промпт. Шесть агентов — каждый специалист в своём
            подходе — работают параллельно и договариваются между собой.
          </p>
          <p className="mt-3 text-[14px] leading-[1.6] text-[#8A7A6A]">
            В чате Ника показывает эмодзи использованных подходов{" "}
            <span className="font-medium">🧠 🌿</span> под каждым ответом — ты всегда
            видишь, кто именно помогал в этот раз.
          </p>
        </motion.div>

        {/* Crisis note */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="mt-6 text-center text-[12px] text-[#B8A898]"
        >
          Встроенный кризисный детектор: если ты напишешь о суицидальных мыслях, система немедленно
          прервёт обычный сценарий и покажет контакты помощи.
        </motion.p>
      </div>
    </section>
  );
}

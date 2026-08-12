import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const techniques = [
  {
    img: "/illustrations/opt/method_cbt.webp",
    fallback: "/illustrations/method_cbt.png",
    name: "Когнитивно-поведенческий подход",
    shortName: "КПТ",
    description: "Работа с мыслями, которые мешают жить",
    examples: ["Я катастрофизирую", "Мысли по кругу", "Прокрастинация"],
  },
  {
    img: "/illustrations/opt/method_jung.webp",
    fallback: "/illustrations/method_jung.png",
    name: "Юнгианский анализ",
    shortName: "Юнг",
    description: "Понимание глубинных слоёв личности и снов",
    examples: ["Снится один и тот же сон", "Не понимаю себя", "Ощущение пустоты"],
  },
  {
    img: "/illustrations/opt/method_act.webp",
    fallback: "/illustrations/method_act.png",
    name: "Подход принятия и ответственности",
    shortName: "ACT",
    description: "Действовать по ценностям, не убегая от чувств",
    examples: ["Не знаю зачем это всё", "Откладываю важное", "Борюсь сам с собой"],
  },
  {
    img: "/illustrations/opt/method_ifs.webp",
    fallback: "/illustrations/method_ifs.png",
    name: "Системный семейный подход",
    shortName: "IFS",
    description: "Примирение внутренних частей личности",
    examples: ["Внутренний критик", "Злюсь на себя", "Чувствую раздробленность"],
  },
  {
    img: "/illustrations/opt/method_narrative.webp",
    fallback: "/illustrations/method_narrative.png",
    name: "Нарративный подход",
    shortName: "Нарратив",
    description: "Переписать историю о себе по-новому",
    examples: ["Чувствую себя неудачником", "Прошлое давит", "Хочу переосмыслить себя"],
  },
  {
    img: "/illustrations/opt/method_somatic.webp",
    fallback: "/illustrations/method_somatic.png",
    name: "Соматический подход",
    shortName: "Соматика",
    description: "Телесное осознание и работа с напряжением",
    examples: ["Тревога в теле", "Сжимается грудь", "Не могу расслабиться"],
  },
];

export default function Techniques() {
  const [hintVisible, setHintVisible] = useState(true);

  useEffect(() => {
    const onScroll = () => {
      if (window.scrollY > 4) setHintVisible(false);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <section className="relative bg-white px-6 py-16">
      {hintVisible && (
        <>
          <motion.div
            className="absolute left-0 right-0 top-0 h-4 bg-white sm:hidden"
            animate={{ y: [0, -12, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            aria-hidden="true"
          />
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.6 }}
            className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 flex-col items-center gap-[5px] sm:hidden"
            aria-hidden="true"
          >
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="block bg-[#C4B5A4]"
                style={{
                  width: 22,
                  height: 9,
                  borderRadius: "0 0 100% 100% / 0 0 100% 100%",
                }}
                animate={{ opacity: [0, 1, 0], y: [4, -4] }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  delay: (2 - i) * 0.4,
                  ease: "easeInOut",
                }}
              />
            ))}
          </motion.div>
        </>
      )}

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
              <img src={t.img} alt={t.shortName} className="h-12 w-12 object-contain" onError={(e) => { if (t.fallback) e.currentTarget.src = t.fallback }} />
              <h4 className="mt-3 font-serif text-[16px] font-semibold text-[#5A5048]">
                {t.shortName}
              </h4>
              <p className="mt-1 text-[13px] leading-[1.5] text-[#8A7A6A]">{t.description}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {t.examples.map((ex) => (
                  <span key={ex} className="inline-block rounded-full bg-[#F3EBE3] px-2 py-0.5 text-[11px] text-[#8A7A6A]">
                    {ex}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

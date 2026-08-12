import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const RAW_BOT = (import.meta.env.VITE_TG_BOT_USERNAME || "").replace(/^@/, "");
const BOT_DISPLAY = RAW_BOT ? `@${RAW_BOT}` : null;
const BOT_LINK = RAW_BOT ? `https://t.me/${RAW_BOT}` : null;

function BotLink() {
  if (!BOT_LINK)
    return <span className="font-semibold text-[#6ABCAA]">бота в Telegram</span>;
  return (
    <a
      href={BOT_LINK}
      target="_blank"
      rel="noopener noreferrer"
      className="font-semibold text-[#6ABCAA] hover:underline"
    >
      {BOT_DISPLAY}
    </a>
  );
}

function Chevron() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

const steps = [
  {
    img: "/illustrations/opt/guide_email.webp",
    fallback: "/illustrations/guide_email.png",
    title: "Войти за 10 секунд",
    panel: (
      <div className="space-y-3 text-[13px] leading-[1.7] text-[#A8D4CC]">
        <p>
          Без пароля. Без «придумайте надёжный пароль из 8 символов». Без СМС с
          кодом, который приходит через три минуты.
        </p>
        <p>
          <span className="font-semibold text-[#D9EDE9]">Через бота:</span>{" "}
          открой <BotLink /> → «Открыть приложение». Всё — ты уже внутри.
        </p>
        <p>
          <span className="font-semibold text-[#D9EDE9]">Через сайт:</span>{" "}
          нажми «Войти», укажи ник в Telegram — придёт 6-значный код в бот.
          Пароль не нужен. Никогда.
        </p>
      </div>
    ),
  },
  {
    img: "/illustrations/opt/guide_chat.webp",
    fallback: "/illustrations/guide_chat.png",
    title: "Пиши как есть",
    panel: (
      <div className="space-y-3 text-[13px] leading-[1.7] text-[#A8D4CC]">
        <p>
          «Мне плохо, не знаю почему» — это нормальное начало разговора. Не
          нужно формулировать, структурировать или искать правильные слова.
        </p>
        <p>
          Ника читает между строк, замечает оттенки и интонацию. Никогда не
          осудит.
        </p>
        <p className="text-[12px] text-[#7ABDB5]">
          🔒 Переписка приватна — ни один человек не читает и не анализирует
          твои сообщения.
        </p>
      </div>
    ),
  },
  {
    img: "/illustrations/opt/guide_actions.webp",
    fallback: "/illustrations/guide_actions.png",
    title: "Стрелка ↑ — твой арсенал",
    panel: (
      <div className="text-[13px] leading-[1.7] text-[#A8D4CC]">
        <p className="mb-3">Кнопка рядом с полем ввода открывает меню:</p>
        <ul className="space-y-2">
          {[
            ["Инсайт", "свежий взгляд, когда сам уже не видишь"],
            ["Упражнение", "конкретная практика прямо сейчас"],
            ["Подышать", "60 секунд, которые реально работают"],
            ["Отвлечься", "поп-ит для перегруженной нервной системы"],
          ].map(([name, desc]) => (
            <li key={name} className="flex items-baseline gap-2">
              <span className="shrink-0 font-semibold text-[#D9EDE9]">
                {name}
              </span>
              <span className="text-[#7ABDB5]">— {desc}</span>
            </li>
          ))}
        </ul>
      </div>
    ),
  },
  {
    img: "/illustrations/opt/guide_memory.webp",
    fallback: "/illustrations/guide_memory.png",
    title: "Она тебя помнит",
    panel: (
      <div className="space-y-3 text-[13px] leading-[1.7] text-[#A8D4CC]">
        <p>
          Включи иконку 🧠 в шапке чата — и Ника запомнит твои цели, паттерны,
          что было тяжело в прошлом, что ты сейчас пробуешь изменить.
        </p>
        <p>
          Как хороший терапевт, который ведёт заметки. Только без двух недель
          ожидания до следующего приёма.
        </p>
      </div>
    ),
  },
  {
    img: "/illustrations/opt/guide_continue.webp",
    fallback: "/illustrations/guide_continue.png",
    title: "Продолжи с того места",
    panel: (
      <div className="space-y-3 text-[13px] leading-[1.7] text-[#A8D4CC]">
        <p>
          Кнопка «Продолжить» на стартовом экране нового чата.
        </p>
        <p>
          Ника прочитает контекст прошлой сессии и начнёт не с «расскажи о
          себе», а с «как ты сейчас?». Нить не теряется.
        </p>
      </div>
    ),
  },
  {
    img: "/illustrations/opt/guide_install.webp",
    fallback: "/illustrations/guide_install.png",
    title: "Всегда под рукой",
    panel: (
      <div className="space-y-3 text-[13px] leading-[1.7] text-[#A8D4CC]">
        <p>
          <span className="font-semibold text-[#D9EDE9]">iOS:</span> Safari →
          Поделиться → На экран Домой
        </p>
        <p>
          <span className="font-semibold text-[#D9EDE9]">Android:</span> Chrome
          → ⋮ → Установить приложение
        </p>
        <p className="text-[12px] text-[#7ABDB5]">
          Ноль мегабайт. Ноль App Store. Работает как нативное приложение.
        </p>
      </div>
    ),
  },
];

export default function UserGuide() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <section className="bg-[#F3EBE3] px-6 py-16">
      <div className="mx-auto max-w-4xl">
        <h2 className="font-serif text-[22px] font-bold text-[#4A4038] text-center">
          Как пользоваться Никой
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-center text-[15px] leading-[1.6] text-[#8A7A6A]">
          Всё, что нужно знать, чтобы начать и получить максимум
        </p>
        <p className="mx-auto mt-3 max-w-md text-center text-[12px] leading-[1.7] text-[#B8A898]">
          Ника опирается на доказательные психологические подходы — КПТ, ACT,
          IFS, юнгианский анализ, нарративный и соматический. За
          каждым стоят десятилетия клинических исследований (Beck, Hayes,
          Schwartz, van der Kolk). Твоя переписка приватна.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: i * 0.06 }}
              className="overflow-hidden rounded-2xl border border-[#E8DDD0]"
              style={{ boxShadow: "0 2px 12px rgba(90,80,72,0.06)" }}
            >
              {/* Button row — always visible */}
              <button
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
                className="flex w-full items-center gap-3 bg-white p-5 text-left transition-colors duration-200 hover:bg-[#FAF6F1]"
              >
                <img
                  src={step.img}
                  alt={step.title}
                  className="h-10 w-10 shrink-0 object-contain"
                  onError={(e) => {
                    e.currentTarget.src = step.fallback;
                  }}
                />
                <span className="flex-1 font-serif text-[15px] font-semibold leading-snug text-[#5A5048]">
                  {step.title}
                </span>
                <motion.div
                  animate={{ rotate: openIdx === i ? 90 : 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28 }}
                  className="shrink-0 text-[#B8A898]"
                >
                  <Chevron />
                </motion.div>
              </button>

              {/* Theatre curtain reveal */}
              <AnimatePresence initial={false}>
                {openIdx === i && (
                  <motion.div
                    key="panel"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{
                      height: {
                        type: "spring",
                        stiffness: 320,
                        damping: 32,
                        mass: 0.9,
                      },
                      opacity: { duration: 0.15 },
                    }}
                    style={{ overflow: "hidden" }}
                  >
                    <div className="bg-[#1E3A3A] px-5 pb-5 pt-4">
                      {step.panel}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

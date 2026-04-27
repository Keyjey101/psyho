import { motion } from "framer-motion";

const cards = [
  {
    img: "/illustrations/opt/guide_email.webp",
    fallback: "/illustrations/guide_email.png",
    title: "Вход по email",
    body: "Введи почту — придёт 6-значный код. Пароль не нужен. Каждый раз входишь по новому коду — быстро и безопасно.",
  },
  {
    img: "/illustrations/opt/guide_chat.webp",
    fallback: "/illustrations/guide_chat.png",
    title: "Просто пиши",
    body: "Пиши как другу, не нужно формулировать «правильно». Ника задаёт уточняющие вопросы и отвечает без осуждения.",
  },
  {
    img: "/illustrations/opt/guide_actions.webp",
    fallback: "/illustrations/guide_actions.png",
    title: "Плитки действий",
    body: null,
    actions: [
      { name: "Инсайт", desc: "свежий взгляд на ситуацию со стороны" },
      { name: "Упражнение", desc: "практическое психологическое задание прямо сейчас" },
      { name: "Подышать", desc: "дыхательные техники для быстрого успокоения" },
      { name: "Отвлечься", desc: "поп-ит для разгрузки нервной системы" },
    ],
    note: "Кнопка ↑ рядом с полем ввода открывает меню:",
  },
  {
    img: "/illustrations/opt/guide_memory.webp",
    fallback: "/illustrations/guide_memory.png",
    title: "Долговременная память",
    body: "Ника запоминает важное между сессиями: твои цели, особенности, прогресс. Иконка мозга в заголовке чата включает и отключает эту функцию.",
  },
  {
    img: "/illustrations/opt/guide_continue.webp",
    fallback: "/illustrations/guide_continue.png",
    title: "Продолжить сессию",
    body: "На экране нового чата есть кнопка «Продолжить». Ника сама восстановит нить предыдущего разговора — не придётся объяснять всё заново.",
  },
  {
    img: "/illustrations/opt/guide_install.webp",
    fallback: "/illustrations/guide_install.png",
    title: "Добавить на телефон",
    body: null,
    pwa: true,
  },
];

export default function UserGuide() {
  return (
    <section className="bg-[#F3EBE3] px-6 py-16">
      <div className="mx-auto max-w-4xl">
        <h2 className="font-serif text-[22px] font-bold text-[#4A4038] text-center">
          Как пользоваться Никой
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-center text-[15px] leading-[1.6] text-[#8A7A6A]">
          Всё, что нужно знать, чтобы начать и получить максимум
        </p>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="rounded-2xl border border-[#E8DDD0] bg-white p-5 transition-all duration-300 hover:border-[#D8CDC0] hover:bg-[#FAF6F1]"
              style={{ boxShadow: "0 2px 12px rgba(90,80,72,0.06)" }}
            >
              <img
                src={card.img}
                alt={card.title}
                className="h-11 w-11 object-contain"
                onError={(e) => { if (card.fallback) e.currentTarget.src = card.fallback }}
              />
              <h4 className="mt-3 font-serif text-[16px] font-semibold text-[#5A5048]">
                {card.title}
              </h4>

              {card.body && (
                <p className="mt-1 text-[13px] leading-[1.6] text-[#8A7A6A]">{card.body}</p>
              )}

              {card.actions && (
                <>
                  <p className="mt-1 text-[13px] text-[#8A7A6A]">{card.note}</p>
                  <ul className="mt-2 space-y-1.5">
                    {card.actions.map((a) => (
                      <li key={a.name} className="flex items-baseline gap-1.5 text-[12px] text-[#8A7A6A]">
                        <span className="font-semibold text-[#B8785A] shrink-0">{a.name}</span>
                        <span>— {a.desc}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {card.pwa && (
                <div className="mt-1 space-y-2 text-[13px] leading-[1.6] text-[#8A7A6A]">
                  <p>
                    Открой сайт в браузере телефона — Safari (iOS) или Chrome (Android), не внутри Instagram или Telegram.
                  </p>
                  <p>
                    <span className="font-medium text-[#5A5048]">iOS:</span> нажми «Поделиться» → «На экран Домой».
                  </p>
                  <p>
                    <span className="font-medium text-[#5A5048]">Android:</span> нажми ⋮ → «Установить приложение» или «Добавить на главный экран».
                  </p>
                  <p className="text-[12px] text-[#B8A898]">
                    Уже отказывался? В Chrome открой ⋮ → «Добавить на главный экран» вручную.
                  </p>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

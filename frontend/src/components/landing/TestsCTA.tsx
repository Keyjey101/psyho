import { Link } from "react-router-dom";
import { ClipboardList, ChevronRight } from "lucide-react";
import { TESTS } from "@/data/tests";

const PREVIEW_EMOJIS = TESTS.slice(0, 6).map((t) => t.emoji);

// Compact, motivational call-to-action that nudges the visitor towards the
// public /tests page. Designed to live between AgentSystem and InsightsFeed
// on the landing.
export default function TestsCTA() {
  return (
    <section className="bg-[#FAF6F1] px-6 py-16 dark:bg-[#2A2420]">
      <div className="mx-auto max-w-3xl">
        <div className="overflow-hidden rounded-3xl border border-[#E8DDD0] bg-white shadow-sm dark:border-[#4A4038] dark:bg-[#352E2A]">
          <div className="grid gap-6 p-7 md:grid-cols-[1fr_auto] md:items-center md:p-9">
            <div>
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-[#FAF0E8] px-3 py-1 text-[11.5px] font-semibold uppercase tracking-wide text-[#B8785A] dark:bg-[#3E342B] dark:text-[#C08B68]">
                <ClipboardList className="h-3.5 w-3.5" />
                {TESTS.length} тестов о себе
              </div>
              <h2 className="mb-2 font-serif text-[26px] font-bold leading-tight text-[#4A4038] dark:text-[#F5EDE4]">
                Узнай о себе чуть больше — за 3-5 минут
              </h2>
              <p className="mb-4 text-[14px] leading-relaxed text-[#8A7A6A] dark:text-[#B8A898]">
                Короткие тесты с выбором ответа: депрессия, тревога, выгорание,
                самооценка, прокрастинация, самосострадание и другие. Только
                научно-обоснованные методики, никакого ИИ — ты сам(а) видишь, что
                с тобой сейчас происходит. И, если захочется — обсудишь это с Никой.
              </p>
              <div className="mb-5 flex flex-wrap gap-1.5 text-2xl">
                {PREVIEW_EMOJIS.map((e, i) => (
                  <span key={i} className="opacity-90">{e}</span>
                ))}
                <span className="rounded-full bg-[#FAF6F1] px-2 py-0.5 text-[11.5px] font-semibold text-[#8A7A6A] dark:bg-[#2A2420] dark:text-[#B8A898] self-center ml-1">
                  +ещё {Math.max(0, TESTS.length - PREVIEW_EMOJIS.length)}
                </span>
              </div>
              <Link
                to="/tests"
                className="inline-flex items-center gap-1.5 rounded-pill bg-[#B8785A] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#9E6349]"
              >
                Перейти к тестам
                <ChevronRight className="h-4 w-4" />
              </Link>
              <p className="mt-3 text-[11.5px] text-[#B8A898] dark:text-[#8A7A6A]">
                Можно проходить без регистрации. Чтобы видеть свою динамику со временем — войди через Telegram.
              </p>
            </div>

            <div className="hidden md:block">
              <div className="relative">
                {/* Decorative stack of "test cards" */}
                <div
                  aria-hidden
                  className="absolute -right-3 -top-3 h-32 w-44 rounded-2xl border border-[#E8DDD0] bg-[#FAF6F1] dark:border-[#4A4038] dark:bg-[#2A2420]"
                  style={{ transform: "rotate(6deg)" }}
                />
                <div
                  aria-hidden
                  className="absolute right-2 top-2 h-32 w-44 rounded-2xl border border-[#E8DDD0] bg-white shadow-sm dark:border-[#4A4038] dark:bg-[#352E2A]"
                  style={{ transform: "rotate(2deg)" }}
                />
                <div className="relative h-32 w-44 rounded-2xl border border-[#B8785A]/40 bg-white p-4 shadow-md dark:border-[#C08B68]/40 dark:bg-[#352E2A]">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#B8785A] dark:text-[#C08B68]">PHQ-9</div>
                  <div className="mb-2 text-2xl">🌧️</div>
                  <div className="mb-1 h-1.5 w-full rounded-full bg-[#E8DDD0] dark:bg-[#4A4038]">
                    <div className="h-full w-[65%] rounded-full bg-[#B8785A]" />
                  </div>
                  <div className="text-[10.5px] text-[#8A7A6A] dark:text-[#B8A898]">9 вопросов</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

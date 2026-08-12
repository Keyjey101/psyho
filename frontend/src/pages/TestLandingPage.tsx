import { useEffect, useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Clock, ShieldCheck, Sparkles } from "lucide-react";
import { getLanding, getLandingTest, estimatedMinutes } from "@/data/testLandings";
import { maxPossibleScore } from "@/data/tests";
import { pluralizeRu, QUESTIONS_PLURAL } from "@/utils/pluralize";
import { captureAttribution, track } from "@/lib/analytics";

/**
 * Ad landing for a single test — the main paid entry point.
 *
 * Deliberate choices:
 * - Attribution is captured on mount, before any interaction, so a visitor who
 *   only converts later is still credited to the right channel.
 * - No signup wall before the test starts; the ask comes after the result.
 * - Copy carries no diagnostic or medical promise (ТЗ §6).
 */
export default function TestLandingPage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const landing = useMemo(() => getLanding(slug), [slug]);
  const test = useMemo(() => getLandingTest(slug), [slug]);

  useEffect(() => {
    captureAttribution();
  }, []);

  useEffect(() => {
    if (!landing || !test) return;
    track("landing_view", { path: `/test/${slug}`, test_slug: slug, test_id: test.id });
  }, [landing, test, slug]);

  useEffect(() => {
    if (slug && !landing) navigate("/tests", { replace: true });
  }, [slug, landing, navigate]);

  if (!landing || !test) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF6F1] dark:bg-[#2A2420]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E8DDD0] border-t-[#B8785A]" />
      </div>
    );
  }

  const minutes = estimatedMinutes(test);
  const maxScore = maxPossibleScore(test);

  const handleStart = () => {
    track("test_started", {
      test_slug: slug,
      test_id: test.id,
      question_count: test.questions.length,
    });
    navigate(`/tests/${test.id}?from=${encodeURIComponent(slug)}&autostart=1`);
  };

  return (
    <div className="min-h-screen bg-[#FAF6F1] dark:bg-[#2A2420]">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-5 pb-12 pt-8 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-3xl border border-[#E8DDD0] bg-white p-7 shadow-sm dark:border-[#4A4038] dark:bg-[#352E2A] sm:p-9"
        >
          <div
            className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl text-3xl"
            style={{ background: test.accent + "22" }}
          >
            <span>{test.emoji}</span>
          </div>

          <h1 className="mb-3 text-center font-serif text-[26px] font-bold leading-tight text-[#4A4038] dark:text-[#F5EDE4] sm:text-[30px]">
            {landing.headline}
          </h1>
          <p className="mb-6 text-center text-[15px] leading-relaxed text-[#5A5048] dark:text-[#C8B8A8]">
            {landing.subline}
          </p>

          <div className="mb-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px] text-[#8A7A6A] dark:text-[#B8A898]">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {minutes} {pluralizeRu(minutes, ["минута", "минуты", "минут"])}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="h-4 w-4" />
              {test.questions.length} {pluralizeRu(test.questions.length, QUESTIONS_PLURAL)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4" />
              Анонимно
            </span>
          </div>

          <ul className="mb-7 space-y-2.5">
            {landing.bullets.map((bullet) => (
              <li
                key={bullet}
                className="flex items-start gap-2.5 text-[14px] leading-relaxed text-[#5A5048] dark:text-[#E8DDD0]"
              >
                <span
                  className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: test.accent }}
                />
                {bullet}
              </li>
            ))}
          </ul>

          {/* No registration wall before the test — the ask comes after the result. */}
          <button
            onClick={handleStart}
            className="w-full rounded-pill bg-[#B8785A] px-6 py-4 text-[15px] font-semibold text-white transition-colors hover:bg-[#9E6349]"
          >
            Пройти тест — {minutes} {pluralizeRu(minutes, ["минута", "минуты", "минут"])}
          </button>
          <p className="mt-3 text-center text-[12px] text-[#B8A898] dark:text-[#8A7A6A]">
            Без регистрации · результат сразу на экране
          </p>

          <div className="mt-7 border-t border-[#E8DDD0] pt-5 text-[12px] leading-relaxed text-[#8A7A6A] dark:border-[#4A4038] dark:text-[#B8A898]">
            <p className="mb-1.5">
              <strong className="font-semibold">Что это.</strong> {test.about}
            </p>
            <p className="mb-1.5">Методика: {test.source}. Максимум — {maxScore} баллов.</p>
            <p>
              Это опросник для самонаблюдения, а не медицинское заключение.
              Результат не является диагнозом и не заменяет консультацию специалиста.
            </p>
          </div>
        </motion.div>

        <div className="mt-6 flex items-center justify-center gap-4 text-[13px] text-[#8A7A6A] dark:text-[#B8A898]">
          <Link to="/tests" className="hover:underline">
            Все тесты
          </Link>
          <span aria-hidden>·</span>
          <Link to="/legal/privacy" className="hover:underline">
            Как мы обращаемся с данными
          </Link>
        </div>
      </div>
    </div>
  );
}

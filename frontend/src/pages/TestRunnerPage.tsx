import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, MessageSquare, RefreshCw } from "lucide-react";
import { getTest, getInterpretation, maxPossibleScore, type PsyTest } from "@/data/tests";
import { appendLocalHistory } from "@/utils/testHistory";
import { useAuthStore } from "@/store/auth";
import api from "@/api/client";

type Phase = "intro" | "questions" | "result";

export default function TestRunnerPage() {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const test = useMemo(() => (testId ? getTest(testId) : undefined), [testId]);
  const [phase, setPhase] = useState<Phase>("intro");
  const [answers, setAnswers] = useState<number[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (testId && !test) {
      navigate("/tests", { replace: true });
    }
  }, [testId, test, navigate]);

  if (!test) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF6F1] dark:bg-[#2A2420]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E8DDD0] border-t-[#B8785A]" />
      </div>
    );
  }

  const startTest = () => {
    setAnswers(new Array(test.questions.length).fill(-1));
    setCurrentIdx(0);
    setPhase("questions");
  };

  const totalScore = answers.reduce((sum, idx, qi) => {
    if (idx < 0) return sum;
    return sum + (test.questions[qi]?.options[idx]?.score ?? 0);
  }, 0);

  const finishTest = async () => {
    if (submitting) return;
    setSubmitting(true);
    const interp = getInterpretation(test, totalScore);
    const entry = {
      testId: test.id,
      score: totalScore,
      level: interp.level,
      completedAt: new Date().toISOString(),
    };

    if (isAuthenticated) {
      try {
        await api.post("/tests/results", {
          test_id: test.id,
          score: totalScore,
          level: interp.level,
        });
      } catch {
        // fall back to localStorage so the user still gets the history view
        appendLocalHistory(entry);
      }
    } else {
      appendLocalHistory(entry);
    }

    setPhase("result");
    setSubmitting(false);
  };

  const handleAnswer = (questionIdx: number, optionIdx: number) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[questionIdx] = optionIdx;
      return next;
    });
    // Auto-advance to next unanswered question after a short delay
    setTimeout(() => {
      if (questionIdx < test.questions.length - 1) {
        setCurrentIdx(questionIdx + 1);
      }
    }, 220);
  };

  return (
    <div className="min-h-screen bg-[#FAF6F1] dark:bg-[#2A2420]">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-5 pb-10 pt-6 lg:px-8">
        <button
          onClick={() => (phase === "questions" ? setPhase("intro") : navigate("/tests"))}
          className="mb-4 inline-flex items-center gap-1.5 self-start text-sm text-[#8A7A6A] hover:text-[#5A5048] dark:text-[#B8A898] dark:hover:text-[#F5EDE4]"
        >
          <ArrowLeft className="h-4 w-4" />
          {phase === "questions" ? "К описанию" : "Все тесты"}
        </button>

        {phase === "intro" && <IntroView test={test} onStart={startTest} />}
        {phase === "questions" && (
          <QuestionsView
            test={test}
            currentIdx={currentIdx}
            answers={answers}
            onAnswer={handleAnswer}
            onPrev={() => setCurrentIdx((i) => Math.max(0, i - 1))}
            onNext={() => setCurrentIdx((i) => Math.min(test.questions.length - 1, i + 1))}
            onFinish={finishTest}
            submitting={submitting}
          />
        )}
        {phase === "result" && (
          <ResultView
            test={test}
            score={totalScore}
            isAuthenticated={isAuthenticated}
            onRetake={() => {
              setAnswers([]);
              setPhase("intro");
            }}
          />
        )}
      </div>
    </div>
  );
}

// ── Intro ────────────────────────────────────────────────────────────────────
function IntroView({ test, onStart }: { test: PsyTest; onStart: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-[#E8DDD0] bg-white p-7 shadow-sm dark:border-[#4A4038] dark:bg-[#352E2A]"
    >
      <div
        className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-3xl"
        style={{ background: test.accent + "22" }}
      >
        <span>{test.emoji}</span>
      </div>
      <span
        className="mx-auto mb-3 block w-fit rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-white"
        style={{ background: test.accent }}
      >
        {test.category}
      </span>
      <h1 className="mb-2 text-center font-serif text-2xl font-bold text-[#4A4038] dark:text-[#F5EDE4]">
        {test.title}
      </h1>
      <p className="mb-5 text-center text-[14px] leading-relaxed text-[#5A5048] dark:text-[#F5EDE4]">
        {test.about}
      </p>

      <ul className="mb-6 space-y-1.5 text-[13px] text-[#8A7A6A] dark:text-[#B8A898]">
        <li>· {test.questions.length} вопросов с выбором ответа</li>
        <li>· Займёт ~{Math.max(1, Math.round(test.questions.length * 0.4))} минут{test.questions.length * 0.4 >= 5 ? "" : "ы"}</li>
        <li>· Источник: {test.source}</li>
      </ul>

      {test.disclaimer && (
        <div className="mb-5 rounded-xl border border-[#E8DDD0] bg-[#FDF5F3] p-3 text-[12px] leading-relaxed text-[#8A7A6A] dark:border-[#4A4038] dark:bg-[#3E2A2A] dark:text-[#B8A898]">
          ⚠️ {test.disclaimer}
        </div>
      )}

      <button
        onClick={onStart}
        className="w-full rounded-pill bg-[#B8785A] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#9E6349]"
      >
        Начать тест
      </button>
    </motion.div>
  );
}

// ── Questions ────────────────────────────────────────────────────────────────
function QuestionsView({
  test, currentIdx, answers, onAnswer, onPrev, onNext, onFinish, submitting,
}: {
  test: PsyTest;
  currentIdx: number;
  answers: number[];
  onAnswer: (q: number, o: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onFinish: () => void;
  submitting: boolean;
}) {
  const question = test.questions[currentIdx];
  const total = test.questions.length;
  const progress = ((currentIdx + (answers[currentIdx] >= 0 ? 1 : 0)) / total) * 100;
  const allAnswered = answers.every((a) => a >= 0);

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between text-[12px] text-[#8A7A6A] dark:text-[#B8A898]">
          <span>Вопрос {currentIdx + 1} из {total}</span>
          <span className="tabular-nums">{Math.round(progress)}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-[#E8DDD0] dark:bg-[#4A4038]">
          <motion.div
            className="h-full rounded-full bg-[#B8785A]"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentIdx}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.25 }}
          className="flex-1 rounded-3xl border border-[#E8DDD0] bg-white p-6 shadow-sm dark:border-[#4A4038] dark:bg-[#352E2A]"
        >
          <h2 className="mb-5 text-[16px] font-medium leading-relaxed text-[#4A4038] dark:text-[#F5EDE4]">
            {question.text}
          </h2>
          <div className="space-y-2">
            {question.options.map((opt, i) => {
              const selected = answers[currentIdx] === i;
              return (
                <button
                  key={i}
                  onClick={() => onAnswer(currentIdx, i)}
                  className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-[14px] transition-all ${
                    selected
                      ? "border-[#B8785A] bg-[#FAF0E8] text-[#4A4038] dark:border-[#C08B68] dark:bg-[#3E342B] dark:text-[#F5EDE4]"
                      : "border-[#E8DDD0] bg-white text-[#5A5048] hover:border-[#D8CDC0] hover:bg-[#FAF6F1] dark:border-[#4A4038] dark:bg-[#352E2A] dark:text-[#F5EDE4] dark:hover:bg-[#4A4038]"
                  }`}
                >
                  <span>{opt.label}</span>
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                      selected ? "border-[#B8785A] bg-[#B8785A]" : "border-[#D8CDC0] dark:border-[#4A4038]"
                    }`}
                  >
                    {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </span>
                </button>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          onClick={onPrev}
          disabled={currentIdx === 0}
          className="flex items-center gap-1.5 rounded-pill border border-[#D8CDC0] px-4 py-2 text-[13px] text-[#8A7A6A] transition-colors hover:bg-[#F5EDE4] disabled:opacity-40 dark:border-[#4A4038] dark:text-[#B8A898] dark:hover:bg-[#4A4038]"
        >
          <ArrowLeft className="h-4 w-4" /> Назад
        </button>
        {currentIdx === total - 1 ? (
          <button
            onClick={onFinish}
            disabled={!allAnswered || submitting}
            className="flex items-center gap-1.5 rounded-pill bg-[#B8785A] px-5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#9E6349] disabled:opacity-50"
          >
            {submitting ? "Считаем..." : "Завершить"}
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={onNext}
            disabled={answers[currentIdx] < 0}
            className="flex items-center gap-1.5 rounded-pill bg-[#B8785A] px-5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#9E6349] disabled:opacity-50"
          >
            Далее <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Result ───────────────────────────────────────────────────────────────────
function ResultView({
  test, score, isAuthenticated, onRetake,
}: {
  test: PsyTest;
  score: number;
  isAuthenticated: boolean;
  onRetake: () => void;
}) {
  const interp = getInterpretation(test, score);
  const max = maxPossibleScore(test);
  const pct = Math.round((score / Math.max(max, 1)) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-[#E8DDD0] bg-white p-7 shadow-sm dark:border-[#4A4038] dark:bg-[#352E2A]"
    >
      <div className="mb-3 text-center">
        <span className="text-5xl">{interp.marker}</span>
      </div>
      <h2 className="mb-1 text-center font-serif text-2xl font-bold text-[#4A4038] dark:text-[#F5EDE4]">
        {interp.level}
      </h2>
      <p className="mb-6 text-center text-[12px] uppercase tracking-wide text-[#B8A898] dark:text-[#8A7A6A]">
        {test.shortTitle} · {score} баллов из {max}
      </p>

      {/* Score bar */}
      <div className="mb-6">
        <div className="h-2 overflow-hidden rounded-full bg-[#E8DDD0] dark:bg-[#4A4038]">
          <motion.div
            className="h-full rounded-full"
            style={{ background: test.accent }}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          />
        </div>
      </div>

      <div className="mb-5 rounded-2xl bg-[#FAF6F1] p-4 dark:bg-[#2A2420]">
        <p className="mb-2 text-[14px] leading-relaxed text-[#4A4038] dark:text-[#F5EDE4]">
          {interp.description}
        </p>
        <p className="text-[13px] leading-relaxed text-[#8A7A6A] dark:text-[#B8A898]">
          💡 {interp.advice}
        </p>
      </div>

      {test.disclaimer && (
        <div className="mb-5 rounded-xl border border-[#E8DDD0] bg-[#FDF5F3] p-3 text-[12px] leading-relaxed text-[#8A7A6A] dark:border-[#4A4038] dark:bg-[#3E2A2A] dark:text-[#B8A898]">
          ⚠️ {test.disclaimer}
        </div>
      )}

      <p className="mb-5 rounded-xl bg-[#FDF5EE] px-4 py-3 text-center text-[12.5px] leading-relaxed text-[#8A7A6A] dark:bg-[#3A302A] dark:text-[#B8A898]">
        Этот тест можно пройти ещё раз через месяц или после двух завершённых сессий с Никой —
        чтобы увидеть динамику.
      </p>

      <div className="space-y-2">
        <Link
          to="/chat"
          className="flex w-full items-center justify-center gap-2 rounded-pill bg-[#B8785A] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#9E6349]"
        >
          <MessageSquare className="h-4 w-4" />
          {isAuthenticated ? "Обсудить с Никой" : "Поговорить с Никой бесплатно"}
        </Link>
        {!isAuthenticated && (
          <p className="text-center text-[11.5px] text-[#B8A898] dark:text-[#8A7A6A]">
            Без регистрации тоже можно — Ника отвечает всем.{" "}
            <Link to="/auth" className="underline-offset-2 hover:underline">
              Войти, чтобы сохранить результат
            </Link>
          </p>
        )}
        <button
          onClick={onRetake}
          className="flex w-full items-center justify-center gap-2 rounded-pill border border-[#D8CDC0] px-6 py-3 text-sm font-medium text-[#8A7A6A] transition-colors hover:bg-[#F5EDE4] dark:border-[#4A4038] dark:text-[#B8A898] dark:hover:bg-[#4A4038]"
        >
          <RefreshCw className="h-4 w-4" />
          Пройти ещё раз
        </button>
      </div>
    </motion.div>
  );
}

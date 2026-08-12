import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Home, MessageSquare } from "lucide-react";
import { getTest, getInterpretation, maxPossibleScore, type PsyTest } from "@/data/tests";
import { slugForTestId } from "@/data/testLandings";
import { appendLocalHistory, type TestHistoryEntry } from "@/utils/testHistory";
import { pluralizeRu, QUESTIONS_PLURAL, POINTS_PLURAL } from "@/utils/pluralize";
import { useAuthStore } from "@/store/auth";
import { useCreateSession } from "@/hooks/useSessions";
import { getCampaignCode, resolveBotLink, track } from "@/lib/analytics";
import CrisisResources, { type CrisisInfo } from "@/components/tests/CrisisResources";
import ShareCard from "@/components/tests/ShareCard";
import api from "@/api/client";

type Phase = "intro" | "questions" | "result";

/**
 * Server verdict on how the result screen must behave. The safety decision is
 * deliberately not computed here — a stale or modified client must not be able
 * to hide crisis contacts or slip a paywall onto a heavy result.
 */
interface Interpretation {
  interpretation: string;
  is_severe: boolean;
  show_crisis_resources: boolean;
  allow_monetization: boolean;
  crisis: CrisisInfo | null;
  disclaimer: string;
}

interface TestDraft {
  answers: number[];
  currentIdx: number;
}

const draftKey = (testId: string) => `psyho.testDraft.${testId}`;

function loadDraft(testId: string): TestDraft | null {
  try {
    const raw = sessionStorage.getItem(draftKey(testId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.answers)) return null;
    if (parsed.answers.every((a: number) => a < 0)) return null; // empty draft
    return { answers: parsed.answers, currentIdx: parsed.currentIdx ?? 0 };
  } catch {
    return null;
  }
}

function saveDraft(testId: string, answers: number[], currentIdx: number) {
  try {
    if (answers.every((a) => a < 0)) {
      sessionStorage.removeItem(draftKey(testId));
      return;
    }
    sessionStorage.setItem(draftKey(testId), JSON.stringify({ answers, currentIdx }));
  } catch {
    /* quota or private mode */
  }
}

function clearDraft(testId: string) {
  try {
    sessionStorage.removeItem(draftKey(testId));
  } catch {
    /* ignore */
  }
}

export default function TestRunnerPage() {
  const { testId } = useParams<{ testId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const test = useMemo(() => (testId ? getTest(testId) : undefined), [testId]);
  // Marketing slug this run belongs to, so every funnel event for a campaign
  // lands under the same name whichever URL the user entered by.
  const slug = useMemo(
    () => searchParams.get("from") || (testId ? slugForTestId(testId) : ""),
    [searchParams, testId],
  );
  const [phase, setPhase] = useState<Phase>("intro");
  const [answers, setAnswers] = useState<number[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [interpretation, setInterpretation] = useState<Interpretation | null>(null);
  const [interpreting, setInterpreting] = useState(false);
  const [draft, setDraft] = useState<TestDraft | null>(() =>
    testId ? loadDraft(testId) : null,
  );
  // Most recent prior attempt for this test (used for comparison in ResultView).
  // Loaded once on mount; we don't refresh while the user takes the test.
  const [previousAttempt, setPreviousAttempt] = useState<TestHistoryEntry | null>(null);

  useEffect(() => {
    if (testId && !test) {
      navigate("/tests", { replace: true });
    }
  }, [testId, test, navigate]);

  useEffect(() => {
    if (!testId) return;
    let cancelled = false;
    async function loadPrevious() {
      let entries: TestHistoryEntry[] = [];
      if (isAuthenticated) {
        try {
          const { data } = await api.get<{
            test_id: string; score: number; level: string; completed_at: string;
          }[]>("/tests/results", { params: { test_id: testId } });
          entries = data.map((r) => ({
            testId: r.test_id, score: r.score, level: r.level, completedAt: r.completed_at,
          }));
        } catch { /* fall through to localStorage */ }
      }
      if (entries.length === 0) {
        try {
          const raw = localStorage.getItem("psyho.testHistory");
          if (raw) {
            const all: TestHistoryEntry[] = JSON.parse(raw);
            entries = all.filter((e) => e.testId === testId);
          }
        } catch { /* ignore */ }
      }
      if (cancelled) return;
      entries.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
      setPreviousAttempt(entries[0] ?? null);
    }
    loadPrevious();
    return () => { cancelled = true; };
  }, [testId, isAuthenticated]);

  // Persist draft on every change while we're in the question phase.
  useEffect(() => {
    if (!testId || phase !== "questions") return;
    saveDraft(testId, answers, currentIdx);
  }, [testId, phase, answers, currentIdx]);

  if (!test) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF6F1] dark:bg-[#2A2420]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E8DDD0] border-t-[#B8785A]" />
      </div>
    );
  }

  const startTest = useCallback(() => {
    setAnswers(new Array(test.questions.length).fill(-1));
    setCurrentIdx(0);
    setDraft(null);
    setInterpretation(null);
    if (testId) clearDraft(testId);
    setPhase("questions");
    track("test_started", {
      test_slug: slug,
      test_id: test.id,
      question_count: test.questions.length,
    });
  }, [test, testId, slug]);

  const resumeFromDraft = () => {
    if (!draft) return;
    // Pad/truncate to current question count in case the catalogue changed.
    const padded = new Array(test.questions.length).fill(-1);
    for (let i = 0; i < Math.min(draft.answers.length, padded.length); i++) {
      padded[i] = draft.answers[i];
    }
    setAnswers(padded);
    // Jump to the first unanswered question, or the saved cursor.
    const firstUnanswered = padded.findIndex((a) => a < 0);
    setCurrentIdx(firstUnanswered >= 0 ? firstUnanswered : draft.currentIdx);
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
    const maxScore = maxPossibleScore(test);
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

    track("test_completed", {
      test_slug: slug,
      test_id: test.id,
      score_band: interp.level,
      question_count: test.questions.length,
    });

    setPhase("result");
    setSubmitting(false);
    if (testId) clearDraft(testId);

    // Per-answer scores go to the interpreter so the backend can check the
    // self-harm item, but they are never persisted as analytics.
    const perItemScores = answers.map(
      (optIdx, qi) => test.questions[qi]?.options[optIdx]?.score ?? 0,
    );

    setInterpreting(true);
    try {
      const { data } = await api.post<Interpretation>("/tests/interpret", {
        test_id: test.id,
        test_title: test.title,
        score: totalScore,
        max_score: maxScore,
        level: interp.level,
        answers: perItemScores,
        campaign_code: getCampaignCode(),
      });
      setInterpretation(data);
      track("test_result_viewed", {
        test_slug: slug,
        test_id: test.id,
        score_band: interp.level,
        is_severe: data.is_severe,
      });
    } catch {
      // Result screen still renders from the static catalogue interpretation.
      track("test_result_viewed", {
        test_slug: slug,
        test_id: test.id,
        score_band: interp.level,
      });
    } finally {
      setInterpreting(false);
    }
  };

  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleAnswer = (questionIdx: number, optionIdx: number) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[questionIdx] = optionIdx;
      return next;
    });
    // Auto-advance to next unanswered question after a short delay
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    autoAdvanceRef.current = setTimeout(() => {
      if (questionIdx < test.questions.length - 1) {
        setCurrentIdx(questionIdx + 1);
      }
    }, 220);
  };

  // Cleanup auto-advance timeout on unmount
  useEffect(() => {
    return () => { if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current); };
  }, []);

  // Arriving from a `/test/<slug>` landing, the user already pressed "start" —
  // don't make them press it twice.
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (autoStartedRef.current) return;
    if (searchParams.get("autostart") !== "1") return;
    autoStartedRef.current = true;
    startTest();
  }, [searchParams, startTest]);

  return (
    <div className="min-h-screen bg-[#FAF6F1] dark:bg-[#2A2420]">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-5 pb-10 pt-6 lg:px-8">
        <div className="mb-4 flex items-center gap-4">
          <button
            onClick={() => (phase === "questions" ? setPhase("intro") : navigate("/tests"))}
            className="inline-flex items-center gap-1.5 text-sm text-[#8A7A6A] hover:text-[#5A5048] dark:text-[#B8A898] dark:hover:text-[#F5EDE4]"
          >
            <ArrowLeft className="h-4 w-4" />
            {phase === "questions" ? "К описанию" : "Все тесты"}
          </button>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-[#8A7A6A] hover:text-[#5A5048] dark:text-[#B8A898] dark:hover:text-[#F5EDE4]"
          >
            <Home className="h-4 w-4" />
            На главную
          </Link>
        </div>

        {phase === "intro" && (
          <IntroView
            test={test}
            onStart={startTest}
            draft={draft}
            onResume={resumeFromDraft}
          />
        )}
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
            previousAttempt={previousAttempt}
            isAuthenticated={isAuthenticated}
            slug={slug}
            interpretation={interpretation}
            interpreting={interpreting}
          />
        )}
      </div>
    </div>
  );
}

// ── Intro ────────────────────────────────────────────────────────────────────
function IntroView({
  test, onStart, draft, onResume,
}: {
  test: PsyTest;
  onStart: () => void;
  draft: TestDraft | null;
  onResume: () => void;
}) {
  const answeredCount = draft?.answers.filter((a) => a >= 0).length ?? 0;
  const resumeQuestion = (() => {
    if (!draft) return 0;
    const firstUnanswered = draft.answers.findIndex((a) => a < 0);
    return firstUnanswered >= 0 ? firstUnanswered : draft.currentIdx;
  })();
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
        <li>· {test.questions.length} {pluralizeRu(test.questions.length, QUESTIONS_PLURAL)} с выбором ответа</li>
        <li>· Займёт ~{Math.max(1, Math.round(test.questions.length * 0.4))} {pluralizeRu(Math.max(1, Math.round(test.questions.length * 0.4)), ["минуту", "минуты", "минут"])}</li>
        <li>· Источник: {test.source}</li>
      </ul>

      {test.disclaimer && (
        <div className="mb-5 rounded-xl border border-[#E8DDD0] bg-[#FDF5F3] p-3 text-[12px] leading-relaxed text-[#8A7A6A] dark:border-[#4A4038] dark:bg-[#3E2A2A] dark:text-[#B8A898]">
          ⚠️ {test.disclaimer}
        </div>
      )}

      {draft && answeredCount > 0 ? (
        <div className="space-y-2">
          <button
            onClick={onResume}
            className="w-full rounded-pill bg-[#B8785A] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#9E6349]"
          >
            Продолжить с вопроса {resumeQuestion + 1}
          </button>
          <button
            onClick={onStart}
            className="w-full rounded-pill border border-[#D8CDC0] px-6 py-3 text-sm font-medium text-[#8A7A6A] transition-colors hover:bg-[#F5EDE4] dark:border-[#4A4038] dark:text-[#B8A898] dark:hover:bg-[#4A4038]"
          >
            Начать заново
          </button>
          <p className="text-center text-[11.5px] text-[#B8A898] dark:text-[#8A7A6A]">
            Сохранён черновик: {answeredCount} из {test.questions.length} {pluralizeRu(test.questions.length, QUESTIONS_PLURAL)}
          </p>
        </div>
      ) : (
        <button
          onClick={onStart}
          className="w-full rounded-pill bg-[#B8785A] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#9E6349]"
        >
          Начать тест
        </button>
      )}
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
  test, score, previousAttempt, isAuthenticated, slug, interpretation, interpreting,
}: {
  test: PsyTest;
  score: number;
  previousAttempt: TestHistoryEntry | null;
  isAuthenticated: boolean;
  slug: string;
  interpretation: Interpretation | null;
  interpreting: boolean;
}) {
  const interp = getInterpretation(test, score);
  const max = maxPossibleScore(test);
  const pct = Math.round((score / Math.max(max, 1)) * 100);
  const navigate = useNavigate();
  const createSession = useCreateSession();
  const [creatingSession, setCreatingSession] = useState(false);

  // Heavy result: crisis contacts lead the screen, and nothing on it may offer
  // to spend money or credits (ТЗ §2.4). Until the verdict arrives we assume
  // the safe branch is possible and simply hold back monetisation.
  const showCrisis = !!interpretation?.show_crisis_resources;
  const allowMonetization = interpretation?.allow_monetization ?? true;

  // Deep link into the bot that carries this visit's campaign through the
  // web → Telegram hop; resolved server-side because only a short code fits.
  const [botLink, setBotLink] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    resolveBotLink(import.meta.env.VITE_TG_BOT_USERNAME).then(({ url }) => {
      if (!cancelled) setBotLink(url);
    });
    return () => { cancelled = true; };
  }, []);

  // Pre-filled message that gets sent on the user's behalf when they tap
  // "Discuss with Nika" — we want Nika to start with full context, not an
  // empty greeting.
  const initialDiscussMessage = (() => {
    const lines = [
      `Я только что прошёл(прошла) тест «${test.title}» и хочу обсудить результаты.`,
      `Мой результат: ${score} из ${max} — «${interp.level}».`,
    ];
    if (previousAttempt && previousAttempt.score !== score) {
      const delta = score - previousAttempt.score;
      const sign = delta > 0 ? "+" : "";
      lines.push(
        `В прошлый раз было ${previousAttempt.score} баллов («${previousAttempt.level}»), сейчас ${sign}${delta}.`,
      );
    }
    lines.push("Помоги мне разобраться, что с этим делать дальше.");
    return lines.join(" ");
  })();

  const handleDiscuss = async () => {
    if (!isAuthenticated) {
      navigate(`/auth?next=/tests/${test.id}`);
      return;
    }
    if (creatingSession) return;
    setCreatingSession(true);
    try {
      const newSession = await createSession.mutateAsync(undefined);
      navigate(`/chat/${newSession.id}`, {
        state: { initialMessage: initialDiscussMessage },
      });
    } catch {
      navigate("/chat");
    } finally {
      setCreatingSession(false);
    }
  };

  // Comparison block info: only meaningful if we have a previous attempt and
  // it isn't literally identical to the just-finished one.
  const showComparison = !!previousAttempt;
  const delta = previousAttempt ? score - previousAttempt.score : 0;
  const improvement = test.lowerIsBetter ? -delta : delta;
  const compareTone = !previousAttempt
    ? "neutral"
    : Math.abs(delta) === 0
      ? "neutral"
      : improvement > 0
        ? "good"
        : "bad";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-[#E8DDD0] bg-white p-7 shadow-sm dark:border-[#4A4038] dark:bg-[#352E2A]"
    >
      {/* Above everything else, by design — louder and earlier than any CTA. */}
      {showCrisis && interpretation?.crisis && (
        <CrisisResources info={interpretation.crisis} />
      )}

      <div className="mb-3 text-center">
        <span className="text-5xl">{interp.marker}</span>
      </div>
      <h2 className="mb-1 text-center font-serif text-2xl font-bold text-[#4A4038] dark:text-[#F5EDE4]">
        {interp.level}
      </h2>
      <p className="mb-6 text-center text-[12px] uppercase tracking-wide text-[#B8A898] dark:text-[#8A7A6A]">
        {test.shortTitle} · {score} {pluralizeRu(score, POINTS_PLURAL)} из {max}
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
        {/* On a heavy result the static "advice" line is withheld — the only
            next step we offer there is a live human on the phone. */}
        {!showCrisis && (
          <p className="text-[13px] leading-relaxed text-[#8A7A6A] dark:text-[#B8A898]">
            💡 {interp.advice}
          </p>
        )}
      </div>

      {/* Personal reading of the result rather than a bare score. */}
      {(interpreting || interpretation) && (
        <div className="mb-5 rounded-2xl border border-[#E8DDD0] bg-white p-4 dark:border-[#4A4038] dark:bg-[#352E2A]">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#B8A898] dark:text-[#8A7A6A]">
            Что это может значить
          </p>
          {interpreting ? (
            <div className="space-y-2" aria-live="polite">
              <div className="h-3 w-full animate-pulse rounded bg-[#F0E7DC] dark:bg-[#4A4038]" />
              <div className="h-3 w-[92%] animate-pulse rounded bg-[#F0E7DC] dark:bg-[#4A4038]" />
              <div className="h-3 w-[78%] animate-pulse rounded bg-[#F0E7DC] dark:bg-[#4A4038]" />
            </div>
          ) : (
            <>
              {interpretation!.interpretation.split("\n").filter(Boolean).map((para, i) => (
                <p
                  key={i}
                  className="mb-2 text-[14px] leading-relaxed text-[#4A4038] last:mb-0 dark:text-[#F5EDE4]"
                >
                  {para}
                </p>
              ))}
              <p className="mt-3 text-[11.5px] leading-relaxed text-[#B8A898] dark:text-[#8A7A6A]">
                {interpretation!.disclaimer}
              </p>
            </>
          )}
        </div>
      )}

      {showComparison && previousAttempt && (
        <div
          className={`mb-5 rounded-2xl border p-4 text-[13px] leading-relaxed ${
            compareTone === "good"
              ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30"
              : compareTone === "bad"
                ? "border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30"
                : "border-[#E8DDD0] bg-white dark:border-[#4A4038] dark:bg-[#352E2A]"
          }`}
        >
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#8A7A6A] dark:text-[#B8A898]">
            В сравнении с прошлым разом
          </p>
          <p className="text-[#4A4038] dark:text-[#F5EDE4]">
            Тогда: <span className="font-semibold">{previousAttempt.score}</span> {pluralizeRu(previousAttempt.score, POINTS_PLURAL)} (
            «{previousAttempt.level}»). Сейчас:{" "}
            <span className="font-semibold">{score}</span> {pluralizeRu(score, POINTS_PLURAL)}{" "}
            (
            <span
              className={
                compareTone === "good"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : compareTone === "bad"
                    ? "text-amber-700 dark:text-amber-400"
                    : "text-[#8A7A6A] dark:text-[#B8A898]"
              }
            >
              {delta === 0 ? "без изменений" : (delta > 0 ? `+${delta}` : `${delta}`)}
            </span>
            ).
          </p>
          {compareTone === "good" && (
            <p className="mt-1 text-[12px] text-emerald-700 dark:text-emerald-400">
              🌱 Похоже, движение в нужную сторону. Замечай, что в этом помогло.
            </p>
          )}
          {compareTone === "bad" && (
            <p className="mt-1 text-[12px] text-amber-700 dark:text-amber-400">
              💛 Стало чуть тяжелее — это бывает. Обсуди с Никой, что изменилось.
            </p>
          )}
        </div>
      )}

      {test.disclaimer && (
        <div className="mb-5 rounded-xl border border-[#E8DDD0] bg-[#FDF5F3] p-3 text-[12px] leading-relaxed text-[#8A7A6A] dark:border-[#4A4038] dark:bg-[#3E2A2A] dark:text-[#B8A898]">
          ⚠️ {test.disclaimer}
        </div>
      )}

      {!showCrisis && (
        <p className="mb-5 rounded-xl bg-[#FDF5EE] px-4 py-3 text-center text-[12.5px] leading-relaxed text-[#8A7A6A] dark:bg-[#3A302A] dark:text-[#B8A898]">
          Этот тест можно пройти ещё раз через месяц или после двух завершённых сессий с Никой —
          чтобы увидеть динамику.
        </p>
      )}

      <div className="space-y-2">
        <button
          onClick={handleDiscuss}
          disabled={creatingSession}
          className={`flex w-full items-center justify-center gap-2 rounded-pill px-6 py-3 text-sm font-semibold transition-colors disabled:opacity-50 ${
            showCrisis
              // Deliberately quieter than the helplines above it.
              ? "border border-[#D8CDC0] text-[#5A5048] hover:bg-[#F5EDE4] dark:border-[#4A4038] dark:text-[#E8DDD0] dark:hover:bg-[#4A4038]"
              : "bg-[#B8785A] text-white hover:bg-[#9E6349]"
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          {creatingSession
            ? "Открываю чат..."
            : showCrisis
              ? "Или напиши Нике — она рядом"
              : isAuthenticated
                ? "Обсудить с Никой"
                : "Войти и обсудить с Никой"}
        </button>

        {botLink && (
          <a
            href={botLink}
            onClick={() => track("test_result_viewed", { test_slug: slug, source: "bot_cta" })}
            className="flex w-full items-center justify-center gap-2 rounded-pill border border-[#D8CDC0] px-6 py-3 text-sm font-medium text-[#5A5048] transition-colors hover:bg-[#F5EDE4] dark:border-[#4A4038] dark:text-[#E8DDD0] dark:hover:bg-[#4A4038]"
          >
            Продолжить в Telegram
          </a>
        )}

        {/* No purchase or credit-spend offer is rendered on a heavy result. */}
        {allowMonetization && (
          <ShareCard
            testSlug={slug}
            testTitle={test.title}
            emoji={test.emoji}
            accent={test.accent}
          />
        )}

        {!isAuthenticated && !showCrisis && (
          <p className="text-center text-[11.5px] text-[#B8A898] dark:text-[#8A7A6A]">
            Без регистрации тоже можно — Ника отвечает всем.{" "}
            <Link to="/auth" className="underline-offset-2 hover:underline">
              Войти, чтобы сохранить результат
            </Link>
          </p>
        )}

        <p className="pt-1 text-center text-[11px] leading-relaxed text-[#B8A898] dark:text-[#8A7A6A]">
          Ника — программа на основе ИИ. Это поддержка и самоанализ, а не
          медицинская помощь и не замена специалисту.
        </p>
      </div>
    </motion.div>
  );
}

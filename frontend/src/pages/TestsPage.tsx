import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight, Check, Lock, Sparkles } from "lucide-react";
import { TESTS, TEST_CATEGORIES, maxPossibleScore, type PsyTest } from "@/data/tests";
import { getTestEligibility, type TestHistoryEntry } from "@/utils/testHistory";
import { pluralizeRu, QUESTIONS_PLURAL } from "@/utils/pluralize";
import Sparkline from "@/components/tests/Sparkline";
import { useAuthStore } from "@/store/auth";
import api from "@/api/client";

interface ServerTestResult {
  test_id: string;
  score: number;
  level: string;
  completed_at: string;
}

type ServerCompletedSessions = { count: number };

export default function TestsPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [history, setHistory] = useState<TestHistoryEntry[]>([]);
  const [completedSessions, setCompletedSessions] = useState(0);
  const [activeCategory, setActiveCategory] = useState<string | "all">("all");

  // Load history (server for auth users, localStorage for guests)
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (isAuthenticated) {
        try {
          const [{ data: results }, sessionRes] = await Promise.all([
            api.get<ServerTestResult[]>("/tests/results"),
            api.get<ServerCompletedSessions>("/tests/completed-sessions").catch(() => ({ data: { count: 0 } })),
          ]);
          if (cancelled) return;
          setHistory(
            results.map((r) => ({
              testId: r.test_id,
              score: r.score,
              level: r.level,
              completedAt: r.completed_at,
            })),
          );
          setCompletedSessions(sessionRes.data.count ?? 0);
        } catch {
          // Fall through to localStorage
        }
      }
      try {
        const raw = localStorage.getItem("psyho.testHistory");
        if (raw && !isAuthenticated) {
          setHistory(JSON.parse(raw));
        }
      } catch {
        /* ignore */
      }
    }
    load();
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  const visibleTests: PsyTest[] = useMemo(() => {
    if (activeCategory === "all") return TESTS;
    return TESTS.filter((t) => t.category === activeCategory);
  }, [activeCategory]);

  // All attempts grouped per test, oldest first. We use this both to render the
  // per-card sparkline AND to find the latest attempt for the eligibility check.
  const historyByTest = useMemo(() => {
    const map = new Map<string, TestHistoryEntry[]>();
    for (const h of history) {
      const arr = map.get(h.testId) ?? [];
      arr.push(h);
      map.set(h.testId, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime());
    }
    return map;
  }, [history]);

  const lastByTest = useMemo(() => {
    const map = new Map<string, TestHistoryEntry>();
    for (const [testId, arr] of historyByTest.entries()) {
      if (arr.length > 0) map.set(testId, arr[arr.length - 1]);
    }
    return map;
  }, [historyByTest]);

  return (
    <div className="min-h-screen bg-[#FAF6F1] p-6 dark:bg-[#2A2420] lg:p-10">
      <div className="mx-auto max-w-4xl">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center gap-2 text-sm text-[#8A7A6A] hover:text-[#5A5048] dark:text-[#B8A898] dark:hover:text-[#F5EDE4]"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад
        </button>

        <header className="mb-6">
          <h1 className="font-serif text-3xl font-bold text-[#4A4038] dark:text-[#F5EDE4]">
            Тесты о себе
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[#8A7A6A] dark:text-[#B8A898]">
            {TESTS.length} коротких тестов с выбором ответа — про настроение, тревогу, выгорание, самооценку и многое другое.
            Каждый тест можно пройти раз в месяц или после двух завершённых сессий с Никой — чтобы увидеть динамику.
          </p>
        </header>

        {!isAuthenticated && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-[#E8DDD0] bg-white p-4 text-sm text-[#5A5048] shadow-sm dark:border-[#4A4038] dark:bg-[#352E2A] dark:text-[#F5EDE4]">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#B8785A] dark:text-[#C08B68]" />
            <div className="flex-1">
              <p className="font-medium">Можно проходить и без регистрации</p>
              <p className="mt-1 text-[#8A7A6A] dark:text-[#B8A898]">
                Но результаты не сохранятся между визитами и ты не увидишь динамику.{" "}
                <Link to="/auth" className="font-medium text-[#B8785A] underline-offset-2 hover:underline dark:text-[#C08B68]">
                  Войди через Telegram
                </Link>
                {" "}— это бесплатно и за минуту.
              </p>
            </div>
          </div>
        )}

        {/* Category filter */}
        <div className="mb-6 flex flex-wrap gap-2">
          <CategoryChip
            label="Все"
            active={activeCategory === "all"}
            onClick={() => setActiveCategory("all")}
          />
          {TEST_CATEGORIES.map((cat) => (
            <CategoryChip
              key={cat}
              label={cat}
              active={activeCategory === cat}
              onClick={() => setActiveCategory(cat)}
            />
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {visibleTests.map((test) => {
            const attempts = historyByTest.get(test.id) ?? [];
            const last = lastByTest.get(test.id);
            const eligibility = getTestEligibility(last, completedSessions);
            return (
              <TestCard
                key={test.id}
                test={test}
                last={last}
                attempts={attempts}
                eligible={eligibility.eligible}
                reason={eligibility.reason}
                onClick={() => navigate(`/tests/${test.id}`)}
              />
            );
          })}
        </div>

        <p className="mt-8 text-center text-[12px] leading-relaxed text-[#B8A898] dark:text-[#8A7A6A]">
          Тесты — для самонаблюдения, не для диагностики. Если что-то тебя серьёзно беспокоит, обратись к специалисту.
        </p>
      </div>
    </div>
  );
}

function CategoryChip({
  label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
        active
          ? "bg-[#B8785A] text-white"
          : "bg-white text-[#5A5048] hover:bg-[#F5EDE4] border border-[#E8DDD0] dark:bg-[#352E2A] dark:text-[#F5EDE4] dark:border-[#4A4038] dark:hover:bg-[#4A4038]"
      }`}
    >
      {label}
    </button>
  );
}

interface TestCardProps {
  test: PsyTest;
  last?: TestHistoryEntry;
  attempts: TestHistoryEntry[];
  eligible: boolean;
  reason: string | null;
  onClick: () => void;
}

function TestCard({ test, last, attempts, eligible, reason, onClick }: TestCardProps) {
  const sparkValues = attempts.slice(-6).map((a) => a.score);
  const sparkMax = maxPossibleScore(test);
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-stretch rounded-2xl border border-[#E8DDD0] bg-white p-5 text-left shadow-sm transition-all hover:border-[#B8785A] hover:shadow-md dark:border-[#4A4038] dark:bg-[#352E2A] dark:hover:border-[#C08B68]"
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl text-lg"
            style={{ background: test.accent + "22" }}
          >
            <span>{test.emoji}</span>
          </div>
          <div>
            <span
              className="inline-block rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-white"
              style={{ background: test.accent }}
            >
              {test.category}
            </span>
          </div>
        </div>
        {last && (
          <div className="flex items-center gap-1 text-[11px] text-[#8A7A6A] dark:text-[#B8A898]">
            <Check className="h-3 w-3 text-emerald-500" />
            пройден
          </div>
        )}
      </div>

      <h3 className="mb-1 text-[15px] font-semibold text-[#4A4038] dark:text-[#F5EDE4]">
        {test.title}
      </h3>
      <p className="mb-3 text-[13px] leading-relaxed text-[#8A7A6A] dark:text-[#B8A898]">
        {test.description}
      </p>

      <div className="mt-auto flex items-center justify-between">
        <span className="text-[11px] text-[#B8A898] dark:text-[#8A7A6A]">
          {test.questions.length} {pluralizeRu(test.questions.length, QUESTIONS_PLURAL)}
        </span>
        {eligible ? (
          <span className="flex items-center gap-1 text-[12px] font-medium text-[#B8785A] dark:text-[#C08B68]">
            {last ? "Пройти ещё раз" : "Пройти"}
            <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[11px] text-[#8A7A6A] dark:text-[#B8A898]">
            <Lock className="h-3 w-3" />
            {reason}
          </span>
        )}
      </div>

      {last && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-[#FAF6F1] px-3 py-2 text-[12px] dark:bg-[#2A2420]">
          <span className="text-[#8A7A6A] dark:text-[#B8A898]">Прошлый раз:</span>
          <div className="flex items-center gap-2">
            {sparkValues.length >= 2 && (
              <Sparkline
                values={sparkValues}
                max={sparkMax}
                lowerIsBetter={test.lowerIsBetter}
              />
            )}
            <span className="font-semibold text-[#4A4038] dark:text-[#F5EDE4]">
              {last.level}
            </span>
          </div>
        </div>
      )}
    </button>
  );
}

/**
 * Ad landing pages for tests.
 *
 * Ads point at `/test/<slug>`, not at internal ids: `/test/anxiety` reads
 * better in a Telegram post than `/test/gad7`, and the slug stays stable if the
 * underlying questionnaire is ever swapped.
 *
 * Copy rules (mirrored on the backend, ТЗ §6): no "терапия", "лечение",
 * "диагноз" or "замена психологу". A test is a self-observation questionnaire —
 * headlines promise a readable result, never an outcome.
 */
import { getTest, type PsyTest } from "@/data/tests";

export interface TestLanding {
  /** URL segment: /test/<slug> */
  slug: string;
  /** Id in the test catalogue. */
  testId: string;
  /** Headline — the promise of what you get, not a claim about you. */
  headline: string;
  /** One supporting line under the headline. */
  subline: string;
  /** Three short bullets shown above the start button. */
  bullets: string[];
}

export const TEST_LANDINGS: TestLanding[] = [
  {
    slug: "anxiety",
    testId: "gad7",
    headline: "Насколько сильна твоя тревога прямо сейчас?",
    subline:
      "7 вопросов — и ты увидишь, где находишься по шкале, которой пользуются во всём мире.",
    bullets: [
      "Понятный результат вместо смутного «что-то не так»",
      "Персональный разбор ответа, а не сухой балл",
      "Анонимно, без регистрации",
    ],
  },
  {
    slug: "depression",
    testId: "phq9",
    headline: "Проверь, что происходит с настроением и энергией",
    subline:
      "9 вопросов по шкале PHQ-9 — о том, как прошли последние две недели.",
    bullets: [
      "Результат объясняем словами, а не цифрой",
      "Если результат тяжёлый — сразу покажем, куда обратиться",
      "Анонимно, без регистрации",
    ],
  },
  {
    slug: "burnout",
    testId: "burnout-short",
    headline: "Это усталость или уже выгорание?",
    subline: "Короткий опросник, чтобы отличить одно от другого.",
    bullets: [
      "Займёт пару минут",
      "Покажем, на какой стадии ты сейчас",
      "Анонимно, без регистрации",
    ],
  },
  {
    slug: "attachment",
    testId: "attachment",
    headline: "Какой у тебя стиль привязанности в отношениях?",
    subline:
      "Почему одни отношения даются легко, а в других постоянно тревожно.",
    bullets: [
      "Разбор твоего стиля простым языком",
      "Что с этим делать дальше",
      "Анонимно, без регистрации",
    ],
  },
  {
    slug: "stress",
    testId: "pss10",
    headline: "Сколько стресса ты на самом деле выдерживаешь",
    subline: "Шкала воспринимаемого стресса — 10 вопросов о последнем месяце.",
    bullets: [
      "Увидишь свой уровень в цифрах и словах",
      "Один конкретный шаг на эту неделю",
      "Анонимно, без регистрации",
    ],
  },
  {
    slug: "self-esteem",
    testId: "rosenberg",
    headline: "Как ты на самом деле к себе относишься?",
    subline: "Классическая шкала самооценки Розенберга.",
    bullets: [
      "Честный срез без осуждения",
      "Разбор результата человеческим языком",
      "Анонимно, без регистрации",
    ],
  },
  {
    slug: "loneliness",
    testId: "ucla3",
    headline: "Насколько ты чувствуешь себя одиноко?",
    subline: "Три вопроса — короткая шкала одиночества UCLA.",
    bullets: [
      "Меньше минуты",
      "Поймёшь, о чём этот сигнал",
      "Анонимно, без регистрации",
    ],
  },
  {
    slug: "procrastination",
    testId: "procrastination",
    headline: "Почему ты откладываешь то, что важно",
    subline: "Опросник про прокрастинацию — без нотаций о продуктивности.",
    bullets: [
      "Причина, а не упрёк",
      "Что попробовать на этой неделе",
      "Анонимно, без регистрации",
    ],
  },
  {
    slug: "social-anxiety",
    testId: "social-anxiety",
    headline: "Стеснительность или социальная тревога?",
    subline: "Короткий опросник о том, как даются встречи с людьми.",
    bullets: [
      "Разбор без ярлыков",
      "Понятные следующие шаги",
      "Анонимно, без регистрации",
    ],
  },
  {
    slug: "boundaries",
    testId: "boundaries",
    headline: "Умеешь ли ты говорить «нет»?",
    subline: "Опросник о личных границах — где они держатся, а где протекают.",
    bullets: [
      "Увидишь свои слабые места",
      "Конкретная практика на неделю",
      "Анонимно, без регистрации",
    ],
  },
];

export function getLanding(slug: string): TestLanding | undefined {
  return TEST_LANDINGS.find((l) => l.slug === slug);
}

export function getLandingTest(slug: string): PsyTest | undefined {
  const landing = getLanding(slug);
  return landing ? getTest(landing.testId) : undefined;
}

/** Reverse lookup, so a runner started from `/tests/<id>` can still name its slug. */
export function slugForTestId(testId: string): string {
  return TEST_LANDINGS.find((l) => l.testId === testId)?.slug ?? testId;
}

/** Rough read time in minutes, used in the "займёт N минут" promise. */
export function estimatedMinutes(test: PsyTest): number {
  return Math.max(1, Math.round(test.questions.length * 0.4));
}

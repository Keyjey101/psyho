// Russian noun pluralization. Picks the right grammatical form for n.
// `forms` is [one, few, many] — the same convention used by ICU MessageFormat.
// Examples:
//   pluralizeRu(1, ["вопрос", "вопроса", "вопросов"]) -> "вопрос"
//   pluralizeRu(2, ["вопрос", "вопроса", "вопросов"]) -> "вопроса"
//   pluralizeRu(5, ["вопрос", "вопроса", "вопросов"]) -> "вопросов"
//   pluralizeRu(11, ["вопрос", "вопроса", "вопросов"]) -> "вопросов"  (тенс trap)
//   pluralizeRu(21, ["вопрос", "вопроса", "вопросов"]) -> "вопрос"
export function pluralizeRu(
  n: number,
  forms: [string, string, string],
): string {
  const abs = Math.abs(Math.floor(n));
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

// Convenience: returns "<n> <plural>" — saves a sprintf at call sites.
export function pluralCountRu(
  n: number,
  forms: [string, string, string],
): string {
  return `${n} ${pluralizeRu(n, forms)}`;
}

export const QUESTIONS_PLURAL: [string, string, string] = ["вопрос", "вопроса", "вопросов"];
export const SESSIONS_ACC_PLURAL: [string, string, string] = ["сессию", "сессии", "сессий"];
export const ATTEMPTS_PLURAL: [string, string, string] = ["попытка", "попытки", "попыток"];
export const POINTS_PLURAL: [string, string, string] = ["балл", "балла", "баллов"];
export const DAYS_PLURAL: [string, string, string] = ["день", "дня", "дней"];

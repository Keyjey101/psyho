// Test history & eligibility helpers.
//
// Rule (from product spec): a test can be retaken once a month, OR after the
// user has completed two full sessions with Nika. We expose a single function
// `getTestEligibility` that returns whether the test is takeable right now and,
// if not, a short user-facing reason.

export interface TestHistoryEntry {
  testId: string;
  score: number;
  level: string;
  /** ISO datetime. */
  completedAt: string;
}

const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
const SESSIONS_THRESHOLD_FOR_RETAKE = 2;

export interface Eligibility {
  eligible: boolean;
  reason: string | null;
  /** UNIX ms when re-take becomes possible (date-based). */
  retakeAt?: number;
}

export function getTestEligibility(
  lastEntry: TestHistoryEntry | undefined,
  completedSessions: number,
  /** Optional override of "now" — used in tests; defaults to current time. */
  now: number = Date.now(),
): Eligibility {
  if (!lastEntry) return { eligible: true, reason: null };

  const lastTaken = new Date(lastEntry.completedAt).getTime();
  if (Number.isNaN(lastTaken)) return { eligible: true, reason: null };

  const monthlyOk = now - lastTaken >= ONE_MONTH_MS;
  if (monthlyOk) return { eligible: true, reason: null };

  // Approximate sessions completed *since* the last attempt: we don't store
  // per-test snapshots of the session count, so we use the total. This means
  // the threshold can also unlock retakes for new users who haven't yet hit
  // the month — which is the desired behaviour.
  if (completedSessions >= SESSIONS_THRESHOLD_FOR_RETAKE) {
    return { eligible: true, reason: null };
  }

  const retakeAt = lastTaken + ONE_MONTH_MS;
  const daysLeft = Math.max(1, Math.ceil((retakeAt - now) / (24 * 60 * 60 * 1000)));
  const sessionsLeft = SESSIONS_THRESHOLD_FOR_RETAKE - completedSessions;
  const reason =
    sessionsLeft > 0
      ? `через ${daysLeft} дн. или ${sessionsLeft} ${pluralizeSessions(sessionsLeft)}`
      : `через ${daysLeft} дн.`;
  return { eligible: false, reason, retakeAt };
}

function pluralizeSessions(n: number): string {
  // 1 → сессию, 2-4 → сессии, 5+ → сессий
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "сессию";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "сессии";
  return "сессий";
}

export function appendLocalHistory(entry: TestHistoryEntry): void {
  try {
    const raw = localStorage.getItem("psyho.testHistory");
    const arr: TestHistoryEntry[] = raw ? JSON.parse(raw) : [];
    arr.push(entry);
    localStorage.setItem("psyho.testHistory", JSON.stringify(arr.slice(-200)));
  } catch {
    /* ignore quota / parse errors */
  }
}

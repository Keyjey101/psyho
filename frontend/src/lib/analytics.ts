/**
 * Client-side attribution capture and funnel tracking.
 *
 * Attribution is stored in localStorage for 30 days and captured on *first
 * paint of any page*, before the user does anything — a visitor who lands on
 * `/test/anxiety?utm_source=x`, reads it, and only signs up an hour later must
 * still be credited to `x`.
 *
 * Two things travel: the raw `utm_*` set and, when present, an explicit
 * campaign code (`?c=`). The backend resolves either into one campaign.
 *
 * Nothing here ever sends message or answer text — payloads carry counts,
 * bands and slugs only. The backend whitelists them again on arrival.
 */
import api from "@/api/client";

const STORAGE_KEY = "psyho_utm";
const ANON_KEY = "psyho_anon_id";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const UTM_FIELDS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

export type UtmPayload = {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  referrer_host?: string | null;
  campaign_code?: string | null;
};

type StoredUtm = UtmPayload & { saved_at: number };

export type EventType =
  | "landing_view"
  | "test_started"
  | "test_completed"
  | "test_result_viewed"
  | "test_shared"
  | "paywall_viewed"
  | "paywall_clicked";

function readStored(): StoredUtm | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredUtm;
    if (!parsed.saved_at || Date.now() - parsed.saved_at > TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function getStoredUtm(): UtmPayload | null {
  const stored = readStored();
  if (!stored) return null;
  const { saved_at: _saved, ...payload } = stored;
  return payload;
}

export function getCampaignCode(): string | null {
  return readStored()?.campaign_code ?? null;
}

/**
 * Stable pseudonymous id for a browser that has no account yet, so
 * `landing_view → test_completed` can be joined into one funnel. Random, not
 * derived from anything about the person.
 */
export function getAnonId(): string {
  try {
    const existing = localStorage.getItem(ANON_KEY);
    if (existing) return existing;
    const generated =
      "web_" +
      (crypto.randomUUID?.().replace(/-/g, "") ??
        Math.random().toString(36).slice(2) + Date.now().toString(36));
    localStorage.setItem(ANON_KEY, generated);
    return generated;
  } catch {
    return "web_ephemeral";
  }
}

/**
 * Reads `utm_*` and `c` off the current URL into storage, then strips them so
 * they don't leak into shared links or screenshots. First touch wins: an
 * existing, unexpired record is never overwritten.
 */
export function captureAttribution(): UtmPayload | null {
  const params = new URLSearchParams(window.location.search);
  const collected: UtmPayload = {};
  let hasAny = false;

  for (const field of UTM_FIELDS) {
    const value = params.get(field);
    if (value) {
      collected[field] = value.slice(0, 128);
      hasAny = true;
    }
  }
  const code = params.get("c");
  if (code && /^[A-Za-z0-9_-]{1,32}$/.test(code)) {
    collected.campaign_code = code;
    hasAny = true;
  }

  if (hasAny) {
    let referrerHost: string | null = null;
    try {
      if (document.referrer) {
        referrerHost = new URL(document.referrer).hostname.slice(0, 128) || null;
      }
    } catch {
      referrerHost = null;
    }
    if (referrerHost) collected.referrer_host = referrerHost;

    // First touch wins — do not overwrite an existing, unexpired record.
    if (!readStored()) {
      try {
        const payload: StoredUtm = { ...collected, saved_at: Date.now() };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch {
        /* storage full or disabled — attribution degrades, app keeps working */
      }
    }

    for (const field of UTM_FIELDS) params.delete(field);
    params.delete("c");
    const search = params.toString();
    const url =
      window.location.pathname + (search ? `?${search}` : "") + window.location.hash;
    window.history.replaceState(null, "", url);
  }

  return getStoredUtm();
}

/**
 * Fire-and-forget funnel event. Never throws and never blocks the UI —
 * analytics failing must be invisible to the user.
 */
export async function track(
  eventType: EventType,
  payload?: Record<string, string | number | boolean>,
): Promise<void> {
  const utm = getStoredUtm() ?? {};
  try {
    await api.post("/track", {
      event_type: eventType,
      campaign_code: utm.campaign_code ?? null,
      anon_id: getAnonId(),
      utm_source: utm.utm_source ?? null,
      utm_medium: utm.utm_medium ?? null,
      utm_campaign: utm.utm_campaign ?? null,
      utm_content: utm.utm_content ?? null,
      payload: payload ?? null,
    });
  } catch {
    /* ignore */
  }
}

/**
 * Bot deep link that carries attribution across the web → Telegram hop.
 *
 * The backend resolves the stored UTM to a campaign (creating one if the
 * combination is new) and returns `t.me/<bot>?start=<code>` — only the short
 * code fits in Telegram's 64-char `[A-Za-z0-9_-]` payload.
 */
export async function resolveBotLink(
  fallbackUsername?: string,
): Promise<{ url: string | null; campaign_code: string }> {
  const utm = getStoredUtm() ?? {};
  try {
    const { data } = await api.post("/bot-link", {
      campaign_code: utm.campaign_code ?? null,
      utm_source: utm.utm_source ?? null,
      utm_medium: utm.utm_medium ?? null,
      utm_campaign: utm.utm_campaign ?? null,
      utm_content: utm.utm_content ?? null,
    });
    return { url: data.url, campaign_code: data.campaign_code };
  } catch {
    const code = utm.campaign_code ?? "organic";
    const username = (fallbackUsername || "").replace(/^@/, "");
    return {
      url: username ? `https://t.me/${username}?start=${code}` : null,
      campaign_code: code,
    };
  }
}

/**
 * Campaign code for a share-card link, so viral reach is measured separately
 * from bought traffic rather than being folded into the buying channel.
 */
export function viralCode(testSlug: string): string {
  return `viral_${testSlug}`.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 32);
}

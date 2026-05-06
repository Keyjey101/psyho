import { useEffect } from "react";

const STORAGE_KEY = "psyho_utm";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const FIELDS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

export type UtmPayload = {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  referrer_host?: string | null;
};

type StoredUtm = UtmPayload & { saved_at: number };

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

/**
 * Captures UTM parameters from the current URL into localStorage on first
 * landing-page visit. Strips them from the URL afterwards so they don't leak
 * into analytics or shared screenshots.
 *
 * Designed to run unconditionally on `<Landing />` mount — idempotent.
 */
export function useUtm() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const collected: UtmPayload = {};
    let hasAny = false;
    for (const f of FIELDS) {
      const v = params.get(f);
      if (v) {
        collected[f] = v.slice(0, 128);
        hasAny = true;
      }
    }
    if (!hasAny) return;

    let referrerHost: string | null = null;
    try {
      if (document.referrer) {
        referrerHost = new URL(document.referrer).hostname.slice(0, 128) || null;
      }
    } catch {
      referrerHost = null;
    }
    if (referrerHost) collected.referrer_host = referrerHost;

    const payload: StoredUtm = { ...collected, saved_at: Date.now() };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // localStorage full / disabled — drop silently
    }

    for (const f of FIELDS) params.delete(f);
    const newSearch = params.toString();
    const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : "") + window.location.hash;
    window.history.replaceState(null, "", newUrl);
  }, []);
}

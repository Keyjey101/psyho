import { useEffect } from "react";
import { captureAttribution } from "@/lib/analytics";

// Attribution now lives in `@/lib/analytics` so it can be used outside React
// (share links, the API layer). Re-exported here to keep existing imports —
// `store/auth.ts` reads UTM when registering a user.
export { getStoredUtm, getCampaignCode } from "@/lib/analytics";
export type { UtmPayload } from "@/lib/analytics";

/**
 * Captures UTM / campaign parameters into localStorage on first visit and
 * strips them from the URL. Mounted app-wide (not just on the landing page):
 * ads point straight at `/test/<slug>`, so capture has to happen wherever the
 * user first arrives.
 */
export function useUtm() {
  useEffect(() => {
    captureAttribution();
  }, []);
}

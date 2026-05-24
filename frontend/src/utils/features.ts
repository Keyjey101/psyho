// Build-time feature flags. Values come from Vite env vars (`VITE_*`),
// baked into the bundle at `npm run build` and surfaced via
// `import.meta.env`. Defaults are off so a missing var stays safe in prod.

function asBool(value: unknown): boolean {
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    return v === "true" || v === "1" || v === "yes" || v === "on";
  }
  return Boolean(value);
}

export const GAME_ON: boolean = asBool(import.meta.env.VITE_GAME_ON);

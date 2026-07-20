/**
 * Remove.bg — détourage via API (rotation multi-comptes).
 *
 * REMOVEBG_API_KEYS : clés séparées par virgule, point-virgule ou saut de ligne.
 * Ex. REMOVEBG_API_KEYS=abc123,def456,ghi789
 */
function parseApiKeys(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  const keys = raw
    .split(/[,;\n]+/)
    .map((k) => k.trim())
    .filter((k) => k.length >= 8);
  return [...new Set(keys)];
}

/** Render.com coupe les requêtes HTTP à ~30 s sur le plan gratuit. */
const onRender = process.env.RENDER === "true";

export const removeBgConfig = {
  apiKeys: parseApiKeys(process.env.REMOVEBG_API_KEYS),
  /** Si toutes les clés sont épuisées, retomber sur le détourage local. */
  fallbackLocal:
    process.env.REMOVEBG_FALLBACK_LOCAL !== "false" &&
    process.env.REMOVEBG_FALLBACK_LOCAL !== "0",
  enabled: parseApiKeys(process.env.REMOVEBG_API_KEYS).length > 0,
  endpoint: "https://api.remove.bg/v1.0/removebg",
  /** type=product convient aux photos produit (maillots). */
  cutoutType: (process.env.REMOVEBG_TYPE?.trim() || "product") as
    | "auto"
    | "person"
    | "product"
    | "car",
  /** auto = meilleure résolution disponible selon le crédit du compte. */
  size: (process.env.REMOVEBG_SIZE?.trim() || "auto") as
    | "auto"
    | "preview"
    | "full"
    | "regular"
    | "medium"
    | "hd"
    | "4k",
  requestTimeoutMs:
    Number(process.env.REMOVEBG_TIMEOUT_MS) || (onRender ? 15_000 : 90_000),
  /** Marge sous la limite Remove.bg (22 Mo). */
  maxUploadBytes: 20 * 1024 * 1024,
  /** Résolution max envoyée à l'API — suffisant pour un maillot, fichier léger. */
  maxUploadDimension: Number(process.env.REMOVEBG_MAX_DIMENSION) || 2048,
} as const;

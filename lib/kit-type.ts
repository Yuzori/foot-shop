export type KitType = "domicile" | "exterieur" | "third";

export const KIT_TYPE_ORDER: KitType[] = ["domicile", "exterieur", "third"];

export const KIT_TYPE_LABELS: Record<KitType, string> = {
  domicile: "Domicile",
  exterieur: "Extérieur",
  third: "Third",
};

const KIT_HOME_TEST =
  /\b(domicile|home|principal|1er|premier|first|heimm|heimtrikot|intérieur|interieur)\b/i;
const KIT_AWAY_TEST =
  /\b(extérieur|exterieur|away|second|deuxième|deuxieme|2e|2ème|auswärts|auswart)\b/i;
const KIT_THIRD_TEST =
  /\b(third|troisième|troisieme|3e|3ème|alternatif|alternate|special)\b/i;

export const KIT_HOME_RE =
  /\b(domicile|home|principal|1er|premier|first|heimm|heimtrikot|intérieur|interieur)\b/gi;
export const KIT_AWAY_RE =
  /\b(extérieur|exterieur|away|second|deuxième|deuxieme|2e|2ème|auswärts|auswart)\b/gi;
export const KIT_THIRD_RE =
  /\b(third|troisième|troisieme|3e|3ème|alternatif|alternate|special)\b/gi;

/** Variantes d'équipe → token canonique pour le matching frère/sœur. */
const TEAM_KEY_REPLACEMENTS: ReadonlyArray<[RegExp, string]> = [
  [/\b(états-unis|etats-unis|etats unis|united states)\b/gi, "usa"],
  [/\busa\b/gi, "usa"],
  [/\bus\b/gi, "usa"],
  [/\b(pays-bas|pays bas|holland|netherlands)\b/gi, "pays-bas"],
  [/\b(côte d'ivoire|cote d'ivoire)\b/gi, "cote-divoire"],
  [/\b(corée du sud|coree du sud|south korea)\b/gi, "coree-du-sud"],
];

function stripKitTokens(text: string): string {
  return text
    .replace(KIT_HOME_RE, " ")
    .replace(KIT_AWAY_RE, " ")
    .replace(KIT_THIRD_RE, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTeamTokens(text: string): string {
  let out = text;
  for (const [pattern, canonical] of TEAM_KEY_REPLACEMENTS) {
    out = out.replace(pattern, canonical);
  }
  return out;
}

function normalizeKitKey(text: string): string {
  return normalizeTeamTokens(stripKitTokens(text))
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Détecte domicile / extérieur / third depuis le nom produit uniquement. */
export function detectKitTypeFromName(name: string): KitType | null {
  const text = name.trim();
  if (!text) return null;
  if (KIT_THIRD_TEST.test(text)) return "third";
  if (KIT_AWAY_TEST.test(text)) return "exterieur";
  if (KIT_HOME_TEST.test(text)) return "domicile";
  return null;
}

/** Type affiché : sans mot-clé kit → domicile par défaut (comme à l'import). */
export function resolveKitTypeFromName(name: string): KitType {
  return detectKitTypeFromName(name) ?? "domicile";
}

/** Clé de regroupement : même équipe, année, audience - sans le type de maillot. */
export function getKitSiblingKey(name: string): string | null {
  if (!/\bmaillot\b/i.test(name)) return null;

  const key = normalizeKitKey(name);
  if (!key || /^maillot(\s+enfant)?$/.test(key)) return null;

  return key;
}

/**
 * Termes de recherche PrestaShop (contient, pas phrase exacte).
 * On cherche par équipe, pas « Maillot USA 2026 » qui rate « Maillot USA Extérieur 2026 ».
 */
export function buildKitSearchQueries(name: string): string[] {
  const stripped = stripKitTokens(name);
  const queries = new Set<string>();

  const teamChunk = stripped
    .replace(/^(maillot|short)\s+/i, "")
    .replace(/^(enfant)\s+/i, "")
    .replace(/\b20[2-3]\d\b.*$/i, "")
    .replace(/\b\d{2}-\d{2}\b.*$/i, "")
    .trim();

  if (teamChunk.length >= 2) {
    queries.add(teamChunk);
    const firstToken = teamChunk.split(/\s+/)[0];
    if (firstToken && firstToken.length >= 2) queries.add(firstToken);
  }

  const siblingKey = getKitSiblingKey(name);
  if (siblingKey) {
    const fromKey = siblingKey
      .replace(/^maillot\s+(enfant\s+)?/, "")
      .replace(/\b20[2-3]\d\b/, "")
      .trim();
    if (fromKey.length >= 2) queries.add(fromKey);
  }

  return [...queries].filter((q) => q.length >= 2);
}

export function kitTypeToFrenchLabel(kitType: KitType): string {
  return KIT_TYPE_LABELS[kitType];
}

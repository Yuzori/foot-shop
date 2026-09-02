/** Règle : si la requête matche, on cherche aussi ces termes (noms produits PrestaShop). */
type SearchAliasRule = {
  match: RegExp;
  terms: readonly string[];
};

const SEARCH_ALIAS_RULES: readonly SearchAliasRule[] = [
  { match: /\bol\b/iu, terms: ["Lyon", "Olympique Lyonnais"] },
  { match: /\bom\b/iu, terms: ["Marseille", "Olympique Marseille"] },
  { match: /\bnaples\b/iu, terms: ["Napoli", "Naples"] },
  { match: /\bnapoli\b/iu, terms: ["Napoli", "Naples"] },
  { match: /\brome\b/iu, terms: ["Roma", "Rome"] },
  { match: /\broma\b/iu, terms: ["Roma", "Rome"] },
  { match: /\bbarça\b/iu, terms: ["Barcelone", "Barcelona"] },
  { match: /\bbarca\b/iu, terms: ["Barcelone", "Barcelona"] },
  { match: /\bbarcelone\b/iu, terms: ["Barcelone", "Barcelona"] },
  { match: /\bbarcelona\b/iu, terms: ["Barcelone", "Barcelona"] },
  { match: /\bpsg\b/iu, terms: ["PSG", "Paris", "Paris Saint-Germain"] },
  { match: /\bparis\b/iu, terms: ["PSG", "Paris", "Paris Saint-Germain"] },
  { match: /\binter\b/iu, terms: ["Inter", "Inter Milan"] },
  { match: /\bmilan\b/iu, terms: ["Milan", "AC Milan"] },
  { match: /\bjuve\b/iu, terms: ["Juventus", "Juve"] },
  { match: /\breal\b/iu, terms: ["Real Madrid", "Real"] },
  { match: /\batletico\b/iu, terms: ["Atlético", "Atletico", "Atlético Madrid"] },
  { match: /\bmonaco\b/iu, terms: ["Monaco", "AS Monaco"] },
  { match: /\blosc\b/iu, terms: ["Lille", "LOSC"] },
];

const SHORT_ALIAS_RE = /\b(ol|om|psg|losc|juve)\b/iu;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function dedupeTerms(terms: string[]): string[] {
  const ordered: string[] = [];
  const seen = new Set<string>();

  for (const value of terms) {
    const key = value.trim();
    if (!key) continue;
    const normalized = key.toLocaleLowerCase("fr");
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    ordered.push(key);
  }

  return ordered;
}

function isRiskyShortApiTerm(term: string): boolean {
  const trimmed = term.trim();
  return (
    trimmed.length <= 4 &&
    SHORT_ALIAS_RE.test(trimmed) &&
    trimmed.split(/\s+/).length === 1
  );
}

/**
 * Étend une requête avec des synonymes / abréviations de clubs.
 * Ex. « OL » → Lyon, « Barça » → Barcelone, « Rome » → Roma.
 */
export function expandSearchTerms(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const terms: string[] = [trimmed];

  for (const rule of SEARCH_ALIAS_RULES) {
    if (!rule.match.test(trimmed)) continue;

    terms.push(...rule.terms);

    const primary = rule.terms[0];
    if (primary) {
      terms.push(trimmed.replace(rule.match, primary));
    }
  }

  return dedupeTerms(terms);
}

/** Termes envoyés à PrestaShop (évite les recherches trop larges sur OL/OM seuls). */
export function buildSearchApiTerms(query: string): string[] {
  const expanded = expandSearchTerms(query);
  if (!expanded.length) return [];

  const apiTerms = expanded.filter((term) => !isRiskyShortApiTerm(term));
  return apiTerms.length > 0 ? apiTerms : expanded;
}

/** Garde les résultats pertinents quand la requête est une abréviation risquée. */
export function productMatchesExpandedSearch(
  productName: string,
  query: string,
  terms: readonly string[],
): boolean {
  const trimmed = query.trim();
  if (!trimmed || !isRiskyShortApiTerm(trimmed)) return true;

  const hay = productName.toLocaleLowerCase("fr");
  const relevant = terms.filter((term) => term.toLocaleLowerCase("fr") !== trimmed.toLocaleLowerCase("fr"));

  return relevant.some((term) => {
    const needle = term.toLocaleLowerCase("fr");
    if (needle.length <= 3) {
      return new RegExp(`\\b${escapeRegExp(needle)}\\b`, "iu").test(productName);
    }
    return hay.includes(needle);
  });
}

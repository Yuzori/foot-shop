/** Slots d’images pour l’import maillot (Unisport / e-commerce). */
export type JerseyImageSlot =
  | "front"
  | "back"
  | "detailTop"
  | "detailBack"
  | "certificate"
  | "sleeve";

export type AutoSelectProfile = "esport" | "standard";

const ESPORT_ORDER: JerseyImageSlot[] = [
  "front",
  "back",
  "detailTop",
  "detailBack",
  "certificate",
  "sleeve",
];

const STANDARD_ORDER: JerseyImageSlot[] = ["front", "back"];

const CERTIFICATE_RE =
  /\b(climacool|authentic|authenticity|certificate|certificat|hologram|original|officiel|official|badge)\b/i;
const SLEEVE_RE = /\b(sleeve|manche|bras|arm|cuff|manchette)\b/i;
const DETAIL_BACK_RE =
  /\b(detail|zoom|macro|close|texture|fabric|col|neck|cou)\b.*\b(back|dos|verso|rear)\b|\b(back|dos|verso|rear)\b.*\b(detail|zoom|macro|close)\b/i;
const DETAIL_TOP_RE =
  /\b(detail|zoom|macro|close|texture|fabric|col|neck|cou|crest|logo|badge)\b/i;
const BACK_RE =
  /\b(back|dos|verso|rear|_b\b|_back|vue[_-]?2|view[_-]?2)\b/i;
const FRONT_RE =
  /\b(front|face|avant|recto|_f\b|_front|vue[_-]?1|view[_-]?1)\b/i;

function classifyImageSlot(url: string, alt = ""): JerseyImageSlot | null {
  const hay = `${url} ${alt}`;

  if (CERTIFICATE_RE.test(hay)) return "certificate";
  if (SLEEVE_RE.test(hay)) return "sleeve";
  if (DETAIL_BACK_RE.test(hay)) return "detailBack";
  if (DETAIL_TOP_RE.test(hay)) return "detailTop";
  if (BACK_RE.test(hay)) return "back";
  if (FRONT_RE.test(hay)) return "front";

  return null;
}

/** Détecte un maillot eSport (6 vues) vs maillot classique (face + dos). */
export function detectAutoSelectProfile(
  title: string,
  sourceUrl = "",
): AutoSelectProfile {
  const hay = `${title}\n${sourceUrl}`;
  if (/\besport\b|gaming|fc\s*\d{2}|fut\s*\d{2}|virtual|digital/i.test(hay)) {
    return "esport";
  }
  return "standard";
}

/**
 * Choisit automatiquement les meilleures images produit.
 * eSport : face, dos, détail haut, détail dos, certificat, manche.
 * Standard : face + dos (rétro / classique).
 */
export function autoSelectJerseyImageUrls(
  imageUrls: readonly string[],
  options?: { title?: string; sourceUrl?: string; profile?: AutoSelectProfile },
): string[] {
  if (!imageUrls.length) return [];

  const profile =
    options?.profile ??
    detectAutoSelectProfile(options?.title ?? "", options?.sourceUrl ?? "");
  const order = profile === "esport" ? ESPORT_ORDER : STANDARD_ORDER;
  const picked = new Map<JerseyImageSlot, string>();

  imageUrls.forEach((url, index) => {
    const slot = classifyImageSlot(url);
    if (slot && !picked.has(slot)) {
      picked.set(slot, url);
    }

    const positional = order[index];
    if (positional && !picked.has(positional)) {
      picked.set(positional, url);
    }
  });

  for (const slot of order) {
    if (!picked.has(slot)) {
      const fallback = imageUrls.find((url) => !Array.from(picked.values()).includes(url));
      if (fallback) picked.set(slot, fallback);
    }
  }

  return order
    .map((slot) => picked.get(slot))
    .filter((url): url is string => Boolean(url));
}

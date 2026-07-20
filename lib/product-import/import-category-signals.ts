import { catalogLeagues } from "@/config/catalog-leagues";
import {
  importExtraCategories,
  importKidsExtraCategories,
  importKidsShortsExtraCategories,
  type ImportExtraCategoryKey,
  type ImportKidsExtraCategoryKey,
} from "@/config/import-extra-categories";

export type ImportCategorySignal =
  | { type: "division"; leagueId: string; reason: string }
  | {
      type: "extra";
      key: ImportExtraCategoryKey;
      reason: string;
    };

const MAILLOT_RETRO_RE =
  /\b(maillot\s*retro|retro|vintage|rétro|époque|classic|classique|anniversaire\s*100)\b/i;
const MAILLOT_CONCEPT_RE = /\b(maillot\s*concept|concept)\b/i;
const HORS_CATEGORIE_RE = /hors\s*cat[ée]gorie/i;
const ENSEMBLE_RE = /\b(ensemble|kids?\s*kit|mini[\s-]?kit|kids?\s*set|baby\s*kit)\b/i;
const CHAMPIONS_RE =
  /\b(champions\s*league|ligue\s*des\s*champions|\bucl\b|\bldc\b)\b/i;
const EURO_RE = /\beuro\s*20\d{2}\b/i;
const COPA_RE = /\bcopa\s*america\b/i;
const CAN_RE = /\bcan\s*20\d{2}\b/i;

const CLUB_LEAGUE_RULES: { leagueId: string; patterns: RegExp[] }[] = [
  {
    leagueId: "ligue-1",
    patterns: [
      /\bpsg\b/i,
      /paris\s*saint[\s-]?germain/i,
      /olympique\s*lyonnais/i,
      /\bol\s*lyon\b/i,
      /\bolympique\s*de\s*lyon\b/i,
      /\blyon\b/i,
      /\bmonaco\b/i,
      /\bmarseille\b/i,
      /\blille\b/i,
      /\blens\b/i,
    ],
  },
  {
    leagueId: "premier-league",
    patterns: [
      /manchester\s*(united|city)/i,
      /\bchelsea\b/i,
      /\bliverpool\b/i,
      /\barsenal\b/i,
      /\btottenham\b/i,
      /\baston\s*villa\b/i,
    ],
  },
  {
    leagueId: "la-liga",
    patterns: [
      /\bfc\s*barcelone\b/i,
      /\bbarcelona\b/i,
      /\bbarça\b/i,
      /\bbarca\b/i,
      /\breal\s*madrid\b/i,
      /\batl[eé]tico\s*madrid\b/i,
    ],
  },
  {
    leagueId: "serie-a",
    patterns: [
      /\bjuventus\b/i,
      /\binter\s*milan\b/i,
      /\bac\s*milan\b/i,
      /\bssc\s*napoli\b/i,
      /\bnapoli\b/i,
      /\bas\s*roma\b/i,
      /\broma\b/i,
    ],
  },
  {
    leagueId: "bundesliga",
    patterns: [
      /\bbayern\b/i,
      /borussia\s*dortmund/i,
      /\bbvb\b/i,
    ],
  },
];

const RESTE_DU_MONDE_CLUBS: RegExp[] = [
  /\bparis\s*fc\b/i,
  /\bajax\b/i,
  /\bbenfica\b/i,
  /\binter\s*miami\b/i,
  /\bal[\s-]?nassr\b/i,
  /\bflamengo\b/i,
  /\bsantos\s*fc\b/i,
  /\bcr\s*flamengo\b/i,
];

/** Extrait le hint entre parenthèses en fin de titre, ex. « (Ligue 1) ». */
export function parseTrailingCategoryHint(title: string): string | null {
  const match = title.match(/\(([^)]+)\)\s*$/);
  return match?.[1]?.trim() ?? null;
}

function hintToLeagueId(hint: string): string | null {
  const h = hint.toLowerCase();
  if (/ligue\s*1|\bl1\b/.test(h)) return "ligue-1";
  if (/premier\s*league|\bepl\b/.test(h)) return "premier-league";
  if (/la\s*liga/.test(h)) return "la-liga";
  if (/serie\s*a/.test(h)) return "serie-a";
  if (/bundesliga/.test(h)) return "bundesliga";
  if (/championnat\s*am[eé]ricain|mls|inter\s*miami/.test(h)) return null;
  if (/championnat\s*n[eé]erlandais/.test(h)) return null;
  if (/championnat\s*br[eé]silien/.test(h)) return null;
  if (/championnat\s*portugais/.test(h)) return null;
  if (/ligue\s*2/.test(h)) return null;
  if (/champions\s*league|ligue\s*des\s*champions|\bucl\b|\bldc\b/.test(h)) {
    return "ligue-des-champions";
  }
  if (/world\s*cup|coupe\s*du\s*monde|\bcdm\b/.test(h)) return "world-cup";
  if (/s[eé]lections?/.test(h)) return "selections";
  if (HORS_CATEGORIE_RE.test(h)) return null;
  return null;
}

function detectClubLeagueId(hay: string): string | null {
  for (const rule of CLUB_LEAGUE_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(hay))) {
      return rule.leagueId;
    }
  }
  return null;
}

function isResteDuMondeClub(hay: string): boolean {
  return RESTE_DU_MONDE_CLUBS.some((pattern) => pattern.test(hay));
}

function hasWorldCupContext(hay: string): boolean {
  if (/\b(world\s*cup|coupe\s*du\s*monde|\bcdm\b|fifa\s*20\d{2})\b/i.test(hay)) {
    return true;
  }
  if (/\b20(?:24|25|26|27)\b/.test(hay) && /\b(coupe\s*du\s*monde|world\s*cup)\b/i.test(hay)) {
    return true;
  }
  return false;
}

function isNationalSelectionProduct(hay: string): boolean {
  const national =
    /\b(brésil|brazil|brasil|france|portugal|allemagne|germany|argentine|espagne|spain|italie|italy|angleterre|england|belgique|belgium|pays-bas|netherlands|mexique|mexico|japon|japan|usa|uruguay|colombie|colombia|cameroun|cameroon|haïti|haiti|grèce|greece|corée|korea|jamaïque|jamaica|irlande|ireland|qatar|algérie|algeria|maroc|morocco|suisse|switzerland|pologne|poland|norvège|norway|suède|sweden|danemark|denmark|autriche|austria|turquie|turkey|nigeria|ghana|chili|chile|pérou|peru|équateur|ecuador|paraguay|australie|australia|canada|sénégal|senegal|tunisie|tunisia|égypte|egypt|arabie|saoudite|iran|irak|chine|china|écosse|scotland|pays\s*de\s*galles|wales)\b/i;
  const club = detectClubLeagueId(hay);
  return national.test(hay) && !club;
}

/** Infère la meilleure catégorie à partir du titre brut + URL. */
export function detectImportCategorySignal(
  title: string,
  sourceUrl = "",
): ImportCategorySignal | null {
  const hay = `${title}\n${sourceUrl}`.trim();
  if (!hay) return null;

  const hint = parseTrailingCategoryHint(title);

  if (MAILLOT_RETRO_RE.test(hay)) {
    return { type: "extra", key: "maillotRetro", reason: "Maillot rétro / vintage" };
  }
  if (MAILLOT_CONCEPT_RE.test(hay)) {
    return { type: "extra", key: "maillotConcept", reason: "Maillot concept" };
  }

  if (hint && HORS_CATEGORIE_RE.test(hint)) {
    return {
      type: "extra",
      key: "resteDuMonde",
      reason: `Hors catégorie — ${hint}`,
    };
  }

  if (isResteDuMondeClub(hay)) {
    return { type: "extra", key: "resteDuMonde", reason: "Club hors divisions principales" };
  }

  if (hint) {
    const fromHint = hintToLeagueId(hint);
    if (fromHint) {
      return { type: "division", leagueId: fromHint, reason: hint };
    }
    if (HORS_CATEGORIE_RE.test(hint) || /championnat|ligue\s*2/i.test(hint)) {
      return {
        type: "extra",
        key: "resteDuMonde",
        reason: hint,
      };
    }
  }

  if (CHAMPIONS_RE.test(hay) && detectClubLeagueId(hay)) {
    return {
      type: "division",
      leagueId: "ligue-des-champions",
      reason: "Ligue des champions",
    };
  }

  const clubLeague = detectClubLeagueId(hay);
  if (clubLeague) {
    const league = catalogLeagues.find((item) => item.id === clubLeague);
    return {
      type: "division",
      leagueId: clubLeague,
      reason: league?.label ?? clubLeague,
    };
  }

  if (EURO_RE.test(hay) || COPA_RE.test(hay) || CAN_RE.test(hay)) {
    return { type: "division", leagueId: "selections", reason: "Sélections" };
  }

  if (hasWorldCupContext(hay) && isNationalSelectionProduct(hay)) {
    return { type: "division", leagueId: "world-cup", reason: "Coupe du monde" };
  }

  if (isNationalSelectionProduct(hay)) {
    return { type: "division", leagueId: "selections", reason: "Sélection nationale" };
  }

  if (ENSEMBLE_RE.test(hay) && isNationalSelectionProduct(hay)) {
    return { type: "division", leagueId: "world-cup", reason: "Ensemble sélection CDM" };
  }

  return null;
}

export function resolveExtraCategoryId(
  key: ImportExtraCategoryKey,
  categories: readonly { id: string; name: string }[],
): string {
  const configured = importExtraCategories[key];
  if (configured) return configured;

  const patterns: Record<ImportExtraCategoryKey, RegExp[]> = {
    resteDuMonde: [/reste\s*du\s*monde/i, /hors\s*cat[ée]gorie/i],
    maillotConcept: [/maillot\s*concept/i, /^concept$/i, /myoconcept/i],
    maillotRetro: [/maillot\s*retro/i, /^retro$/i, /rétro/i, /myoretro/i],
  };

  const hit = categories.find((category) =>
    patterns[key].some((pattern) => pattern.test(category.name)),
  );
  return hit?.id ?? "";
}

export function resolveExtraKidsCategoryId(
  key: ImportKidsExtraCategoryKey,
  categories: readonly { id: string; name: string; parentId?: string | null }[],
  kidsBaseId: string,
  kidsShortsBaseId = "",
): string {
  const kidsBase = String(kidsBaseId ?? "").trim();
  const shortsBase = String(kidsShortsBaseId ?? "").trim();
  const isShortsParent = shortsBase !== "" && kidsBase === shortsBase;

  const configured = isShortsParent
    ? importKidsShortsExtraCategories[key as keyof typeof importKidsShortsExtraCategories]
    : importKidsExtraCategories[key];

  if (configured) {
    const hit = categories.find((category) => category.id === configured);
    if (!hit || String(hit.parentId ?? "").trim() === kidsBase) {
      return configured;
    }
  }

  const patterns: Record<ImportKidsExtraCategoryKey, RegExp[]> = {
    resteDuMonde: [/reste\s*du\s*monde/i, /hors\s*cat[ée]gorie/i],
    maillotConcept: [/maillot\s*concept/i, /^concept$/i],
    maillotRetro: [/maillot\s*retro/i, /^retro$/i, /rétro/i],
  };

  const hit = categories.find(
    (category) =>
      String(category.parentId ?? "").trim() === kidsBase &&
      patterns[key].some((pattern) => pattern.test(category.name)),
  );
  return hit?.id ?? "";
}

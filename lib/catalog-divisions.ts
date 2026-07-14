import {

  catalogLeagues,

  type CatalogLeague,

} from "@/config/catalog-leagues";

import type { ProductCollectionKind } from "@/lib/product-collection";



/** Division catalogue (ligue, CDM, etc.) — partagée import + navigation. */

export interface CatalogDivision {

  leagueId: string;

  label: string;

  adultCategoryId?: string;

  kidsNamePatterns: RegExp[];

}



const DIVISION_MATCHERS: Record<

  string,

  { adult: RegExp[]; kids: RegExp[] }

> = {

  "world-cup": {

    adult: [

      /\bcdm\b/i,

      /coupe\s*du\s*monde/i,

      /world\s*cup/i,

      /\bfifa\b/i,

      /coupe-du-monde/i,

      /world-cup/i,

    ],

    kids: [

      /\bcdm\b/i,

      /coupe\s*du\s*monde/i,

      /world\s*cup/i,

      /\bfifa\b/i,

      /coupe-du-monde/i,

      /world-cup/i,

    ],

  },

  "ligue-1": {

    adult: [/ligue\s*1/i, /\bl1\b/i],

    kids: [/ligue\s*1/i, /\bl1\b/i],

  },

  "premier-league": {

    adult: [/premier\s*league/i, /\bepl\b/i],

    kids: [/premier\s*league/i, /\bepl\b/i],

  },

  "la-liga": {

    adult: [/la\s*liga/i, /\bliga\b/i],

    kids: [/la\s*liga/i, /\bliga\b/i],

  },

  "serie-a": {

    adult: [/serie\s*a/i],

    kids: [/serie\s*a/i],

  },

  bundesliga: {

    adult: [/bundesliga/i],

    kids: [/bundesliga/i],

  },

  "ligue-des-champions": {

    adult: [

      /ligue\s*des\s*champions/i,

      /champions\s*league/i,

      /\bucl\b/i,

      /\bldc\b/i,

    ],

    kids: [

      /ligue\s*des\s*champions/i,

      /champions\s*league/i,

      /\bucl\b/i,

      /\bldc\b/i,

    ],

  },

  selections: {

    adult: [/sélections?/i, /selections?/i],

    kids: [/sélections?/i, /selections?/i],

  },

};



function divisionFromLeague(league: CatalogLeague): CatalogDivision {

  const matchers = DIVISION_MATCHERS[league.id];

  return {

    leagueId: league.id,

    label: league.label,

    adultCategoryId: league.categoryId,

    kidsNamePatterns: matchers?.kids ?? [new RegExp(escapeRegExp(league.label), "i")],

  };

}



export function catalogDivisionFromLeague(league: {

  id: string;

  label: string;

  categoryId?: string;

}): CatalogDivision {

  return divisionFromLeague(league as CatalogLeague);

}



function escapeRegExp(value: string): string {

  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

}



function nameMatchesPatterns(name: string, patterns: RegExp[]): boolean {

  return patterns.some((pattern) => pattern.test(name));

}



const NATIONAL_TEAM_RE =

  /\b(espagne|spain|allemagne|germany|italie|italy|angleterre|england|portugal|brésil|brazil|brasil|argentine|belgique|belgium|pays-bas|netherlands|holland|maroc|morocco|usa|états-unis|mexique|mexico|japon|japan|croatie|croatia|sénégal|senegal|algérie|algeria|tunisie|tunisia|égypte|egypt|pologne|poland|suisse|switzerland|uruguay|colombie|cameroun|canada|australie|corée|korea|équateur|ecuador|danemark|danmark|suède|sweden|norvège|norway|autriche|austria|serbie|serbia|pays\s*de\s*galles|wales|écosse|scotland|irlande|ireland|turquie|turkey|ukraine|chili|chile|paraguay|peru|pérou|nigeria|ghana|costa\s*rica|panama|qatar|arabie|saoudite|iran|irak|chine|china)\b/i;



const CLUB_RE =

  /\b(psg|paris\s*saint|marseille|olympique\s*de\s*marseille|\bom\b|lyon|ol\b|monaco|lille|lens|rennes|nice|nantes|manchester|liverpool|chelsea|arsenal|tottenham|city|barcelona|barça|barca|real\s*madrid|atletico|atlético|bayern|dortmund|milan|inter|juventus|napoli|roma|ajax|benfica|sporting|porto|galatasaray|fenerbahce|celtic|rangers)\b/i;



const WORLD_CUP_CONTEXT_RE =

  /\b(world\s*cup|coupe\s*du\s*monde|\bcdm\b|fifa\s*20\d{2}|wc\s*20\d{2}|coupe-du-monde|world-cup)\b/i;



const WORLD_CUP_YEAR_RE = /\b20(?:22|23|24|25|26|27)\b/;



const NATIONAL_KIT_RE =

  /\b(exterieur|extérieur|exterior|away|domicile|home|third|troisieme|troisième|gardien|goalkeeper|maillot|jersey|kit)\b/i;



const EURO_ONLY_RE = /\beuro\s*20\d{2}\b/i;

const NATIONS_LEAGUE_RE = /nations?\s*league/i;



function isNationalTeamProduct(hay: string): boolean {

  return NATIONAL_TEAM_RE.test(hay) && !CLUB_RE.test(hay);

}



function hasWorldCupSignals(hay: string): boolean {

  if (WORLD_CUP_CONTEXT_RE.test(hay)) return true;

  if (WORLD_CUP_YEAR_RE.test(hay) && NATIONAL_TEAM_RE.test(hay)) return true;

  if (isNationalTeamProduct(hay) && NATIONAL_KIT_RE.test(hay)) return true;

  return false;

}



/** Infère la division catalogue depuis le titre et l'URL produit. */

export function detectDivisionFromProductText(text: string): CatalogDivision | null {

  if (!text.trim()) return null;

  const hay = text;



  const worldCupLeague = catalogLeagues.find((league) => league.id === "world-cup");



  if (worldCupLeague && hasWorldCupSignals(hay)) {

    if (!EURO_ONLY_RE.test(hay) && !NATIONS_LEAGUE_RE.test(hay)) {

      return divisionFromLeague(worldCupLeague);

    }

  }



  const clubLeagues = catalogLeagues.filter(

    (league) => league.id !== "selections" && league.id !== "world-cup",

  );

  for (const league of clubLeagues) {

    const matchers = DIVISION_MATCHERS[league.id];

    if (matchers?.adult.some((pattern) => pattern.test(hay))) {

      return divisionFromLeague(league);

    }

  }



  if (worldCupLeague && isNationalTeamProduct(hay)) {

    if (!EURO_ONLY_RE.test(hay) && !NATIONS_LEAGUE_RE.test(hay)) {

      return divisionFromLeague(worldCupLeague);

    }

  }



  const selectionsMatchers = DIVISION_MATCHERS.selections;

  if (selectionsMatchers?.adult.some((pattern) => pattern.test(hay))) {

    const selections = catalogLeagues.find((league) => league.id === "selections");

    if (selections) return divisionFromLeague(selections);

  }



  return null;

}



/** Identifie la division à partir de l'ID de catégorie choisi à l'import. */

export function getDivisionForCategoryId(

  categoryId: string,

  categories: readonly { id: string; name: string }[],

): CatalogDivision | null {

  const trimmed = categoryId.trim();

  if (!trimmed) return null;



  const byLeague = catalogLeagues.find((league) => league.categoryId === trimmed);

  if (byLeague) return divisionFromLeague(byLeague);



  const category = categories.find((item) => item.id === trimmed);

  if (!category) return null;



  for (const league of catalogLeagues) {

    const matchers = DIVISION_MATCHERS[league.id];

    if (matchers && nameMatchesPatterns(category.name, matchers.adult)) {

      return divisionFromLeague(league);

    }

  }



  return null;

}



/** Sous-catégorie enfant d'une division (ex. Enfant - Maillots > CDM). */

export function findKidsDivisionCategoryId(

  categories: readonly { id: string; name: string; parentId?: string | null }[],

  kidsBaseCategoryId: string,

  division: CatalogDivision,

): string {

  if (!kidsBaseCategoryId) return "";



  const match = categories.find(

    (category) =>

      category.parentId === kidsBaseCategoryId &&

      nameMatchesPatterns(category.name, division.kidsNamePatterns),

  );

  return match?.id ?? "";

}



/** Sous-catégorie adulte d'une division (ex. Maillots > Ligue 1). */

export function findAdultDivisionCategoryId(

  categories: readonly { id: string; name: string; parentId?: string | null }[],

  adultBaseCategoryId: string,

  division: CatalogDivision,

): string {

  if (division.adultCategoryId) return division.adultCategoryId;

  if (!adultBaseCategoryId) return "";



  const matchers = DIVISION_MATCHERS[division.leagueId];

  if (!matchers) return "";



  const match = categories.find(

    (category) =>

      category.parentId === adultBaseCategoryId &&

      nameMatchesPatterns(category.name, matchers.adult),

  );

  return match?.id ?? "";

}



export function kidsDivisionCategoryLabel(division: CatalogDivision): string {

  if (division.leagueId === "world-cup") return "World Cup";

  return division.label;

}



export function kidsDivisionMissingError(

  kind: ProductCollectionKind,

  division: CatalogDivision,

  kidsBaseLabel: string,

): string {

  const divisionLabel = kidsDivisionCategoryLabel(division);

  const kindLabel = kind === "short" ? "short" : "maillot";

  return (

    `Produit enfant détecté pour la division « ${division.label} » mais sous-catégorie ` +

    `« ${divisionLabel} » introuvable sous « ${kidsBaseLabel} ». ` +

    `Créez Maillot - Enfant > ${divisionLabel} dans PrestaShop ` +

    `(parent = ${kidsBaseLabel}, nom conseillé : ${divisionLabel}).`

  );

}



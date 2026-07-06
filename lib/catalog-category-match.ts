/** Correspond à « Maillot - Enfant », « Enfant - Maillots », etc. */
export function matchKidsMaillotsCategory(name: string): boolean {
  const n = name.toLowerCase();
  if (/maillot\s*[-–—]\s*enfant/i.test(name)) return true;
  if (/enfant\s*[-–—]\s*maillot/i.test(name)) return true;
  return /\benfant\b/.test(n) && /\bmaillot/i.test(n);
}

/** Correspond à « Enfant - Short » / « Enfant - Shorts ». */
export function matchKidsShortsCategory(name: string): boolean {
  const n = name.toLowerCase();
  if (/enfant\s*[-–—]\s*shorts?/i.test(name)) return true;
  return /\benfant\b/.test(n) && /\bshorts?\b/i.test(n);
}

export function findCategoryIdByMatcher(
  categories: readonly { id: string; name: string }[],
  matcher: (name: string) => boolean,
  excludeIds: string[] = [],
): string {
  const match = categories.find(
    (c) => !excludeIds.includes(c.id) && matcher(c.name),
  );
  return match?.id ?? "";
}

const STORAGE_KEY = "maillot-store-quick-import-draft-v3";
const LEGACY_STORAGE_KEY = "maillot-store-quick-import-draft-v2";

export type QuickImportBrokenLink = { url: string; error: string };

export type QuickImportProduct = {
  id: string;
  sourceUrl: string;
  name: string;
  collectionKind: string;
  imageUrls: string[];
  selectedUrls: string[];
  scrapeError: string | null;
  categoryId: string;
  suggestedCategoryId: string | null;
  suggestedCategoryLabel: string | null;
  suggestedCategoryReason: string | null;
  pushResult: { ok: boolean; productId?: string; error?: string } | null;
};

export type QuickImportDraft = {
  version: 3;
  savedAt: number;
  urlsText: string;
  price: string;
  stock: string;
  defaultCategoryId: string;
  products: QuickImportProduct[];
  brokenLinks: QuickImportBrokenLink[];
};

function stripPushResults(products: QuickImportProduct[]): QuickImportProduct[] {
  return products.map((product) => ({ ...product, pushResult: null }));
}

function migrateDraft(parsed: QuickImportDraft & { version?: number }): QuickImportDraft {
  return {
    version: 3,
    savedAt: parsed.savedAt ?? Date.now(),
    urlsText: parsed.urlsText ?? "",
    price: parsed.price ?? "25.99",
    stock: parsed.stock ?? "20",
    defaultCategoryId: parsed.defaultCategoryId ?? "",
    products: stripPushResults(parsed.products ?? []),
    brokenLinks: parsed.brokenLinks ?? [],
  };
}

export function loadQuickImportDraft(): QuickImportDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as QuickImportDraft;
      if (parsed?.version === 3 && Array.isArray(parsed.products)) {
        return parsed;
      }
    }

    const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacy) return null;
    const migrated = migrateDraft(JSON.parse(legacy) as QuickImportDraft);
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    return migrated;
  } catch {
    return null;
  }
}

export function saveQuickImportDraft(draft: QuickImportDraft): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...draft, version: 3 }),
    );
    return true;
  } catch {
    return false;
  }
}

export function clearQuickImportDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // ignore
  }
}

const STORAGE_KEY = "maillot-store-quick-import-draft-v2";

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
  version: 2;
  savedAt: number;
  urlsText: string;
  price: string;
  stock: string;
  defaultCategoryId: string;
  products: QuickImportProduct[];
  brokenLinks: QuickImportBrokenLink[];
};

export function loadQuickImportDraft(): QuickImportDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as QuickImportDraft;
    if (parsed?.version !== 2 || !Array.isArray(parsed.products)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveQuickImportDraft(draft: QuickImportDraft): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function clearQuickImportDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

import type { ProductCollectionKind } from "@/lib/product-collection";
import type { JerseyRenderMode } from "@/lib/jersey-studio/render-mode";

const STORAGE_KEY = "maillot-store-jersey-studio-draft-v1";
const MAX_BYTES = 4_500_000;

export type PersistedStudioSelection = {
  id: string;
  kind: "scraped" | "manual";
  url?: string;
  mode: JerseyRenderMode;
  renderPreview?: string | null;
  renderError?: string | null;
  manualPreview?: string | null;
};

export type PersistedStudioProduct = {
  id: string;
  sourceUrl: string;
  name: string;
  collectionKind: ProductCollectionKind;
  imageUrls: string[];
  scrapeError: string | null;
  selections: PersistedStudioSelection[];
  categoryGroupId: string;
  categoryDivisionId: string | null;
  categoryId: string;
  suggestedCategoryId: string | null;
  suggestedCategoryLabel: string | null;
  suggestedCategoryReason: string | null;
  pushResult: { ok: boolean; productId?: string; error?: string } | null;
  modifiedAt: number;
};

export type StudioDraft = {
  version: 1;
  savedAt: number;
  urlsText: string;
  price: string;
  stock: string;
  defaultCategoryId: string;
  brokenLinks: { url: string; error: string }[];
  products: PersistedStudioProduct[];
  lastModifiedProductId: string | null;
};

function stripHeavySelections(
  selections: PersistedStudioSelection[],
): PersistedStudioSelection[] {
  return selections.map((s) => ({
    id: s.id,
    kind: s.kind,
    url: s.url,
    mode: s.mode,
    renderError: s.renderError ?? null,
    renderPreview: null,
    manualPreview: null,
  }));
}

function toLiteDraft(draft: StudioDraft): StudioDraft {
  return {
    ...draft,
    products: draft.products.map((p) => ({
      ...p,
      selections: stripHeavySelections(p.selections),
    })),
  };
}

export function loadStudioDraft(): StudioDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StudioDraft;
    if (parsed?.version !== 1 || !Array.isArray(parsed.products)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveStudioDraft(draft: StudioDraft): {
  ok: boolean;
  lite: boolean;
} {
  if (typeof window === "undefined") return { ok: false, lite: false };

  try {
    const payload = JSON.stringify(draft);
    if (payload.length <= MAX_BYTES) {
      window.localStorage.setItem(STORAGE_KEY, payload);
      return { ok: true, lite: false };
    }

    const lite = JSON.stringify(toLiteDraft(draft));
    window.localStorage.setItem(STORAGE_KEY, lite);
    return { ok: true, lite: true };
  } catch {
    try {
      const lite = JSON.stringify(toLiteDraft(draft));
      window.localStorage.setItem(STORAGE_KEY, lite);
      return { ok: true, lite: true };
    } catch {
      return { ok: false, lite: false };
    }
  }
}

export function clearStudioDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

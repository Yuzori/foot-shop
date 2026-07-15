"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, TextareaField } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import {
  buildAdminCategoryOptGroups,
  flattenAdminCategoryOptGroups,
  type AdminCategoryOptGroup,
} from "@/lib/admin/import-category-tree";
import { type JerseyRenderMode } from "@/lib/jersey-studio/render-mode";
import {
  hydrateManualSelections,
  deleteManualImage,
  putManualImage,
  pruneManualImages,
} from "@/lib/jersey-studio/studio-manual-images";
import {
  loadStudioDraft,
  saveStudioDraft,
  type PersistedStudioProduct,
} from "@/lib/jersey-studio/studio-draft-storage";
import type { ProductCollectionKind } from "@/lib/product-collection";
import { parseSourceUrls } from "@/lib/product-import/parse-urls";
import { cn } from "@/lib/utils";

type CategoryOption = { id: string; name: string; parentId?: string | null };

type StudioImageSelection = {
  id: string;
  kind: "scraped" | "manual";
  url?: string;
  manualBase64?: string;
  manualPreview?: string;
  mode: JerseyRenderMode;
  renderPreview: string | null;
  renderError: string | null;
};

type StudioProduct = {
  id: string;
  sourceUrl: string;
  name: string;
  collectionKind: ProductCollectionKind;
  imageUrls: string[];
  scrapeError: string | null;
  selections: StudioImageSelection[];
  categoryGroupId: string;
  categoryDivisionId: string | null;
  categoryId: string;
  suggestedCategoryId: string | null;
  suggestedCategoryLabel: string | null;
  suggestedCategoryReason: string | null;
  pushResult: { ok: boolean; productId?: string; error?: string } | null;
  modifiedAt: number;
};

function CategorySelect({
  optGroups,
  value,
  disabled,
  onChange,
}: {
  optGroups: AdminCategoryOptGroup[];
  value: string;
  disabled?: boolean;
  onChange: (categoryId: string) => void;
}) {
  const flat = flattenAdminCategoryOptGroups(optGroups);
  const resolvedValue =
    flat.some((o) => o.id === value) ? value : (flat[0]?.id ?? "");

  if (!flat.length) {
    return (
      <p className="rounded-lg border border-dashed border-ink/15 px-3 py-2 text-xs text-ink/50">
        Aucune catégorie — vérifiez PrestaShop ou rechargez la page.
      </p>
    );
  }

  return (
    <select
      className="w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm text-ink"
      value={resolvedValue}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      {optGroups.map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

async function readImageFile(file: File): Promise<{ base64: string; preview: string }> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Fichier image requis.");
  }
  if (file.size > 12 * 1024 * 1024) {
    throw new Error("Image trop volumineuse (max 12 Mo).");
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Lecture impossible."));
        return;
      }
      const base64 = result.split(",")[1];
      if (!base64) {
        reject(new Error("Lecture impossible."));
        return;
      }
      resolve({ base64, preview: result });
    };
    reader.onerror = () => reject(new Error("Lecture impossible."));
    reader.readAsDataURL(file);
  });
}

function newProductId() {
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function newSelectionId() {
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function asTrimmedString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

type ScrapedApiProduct = {
  sourceUrl: string;
  name: string;
  description?: string;
  collectionKind?: ProductCollectionKind;
  imageUrls: string[];
  suggestedCategoryId?: unknown;
  suggestedCategoryLabel?: unknown;
  suggestedCategoryReason?: unknown;
  error?: string;
};

type BrokenScrapeLink = { url: string; error: string };

function isBrokenScrape(p: ScrapedApiProduct): boolean {
  return Boolean(p.error);
}

function mapScrapedApiProduct(
  p: ScrapedApiProduct,
  flatCategories: { id: string }[],
  defaultCategoryId: string,
): StudioProduct {
  const suggestedId = asTrimmedString(p.suggestedCategoryId);
  const categoryId =
    suggestedId && flatCategories.some((o) => o.id === suggestedId)
      ? suggestedId
      : defaultCategoryId;
  const selections: StudioImageSelection[] = [];

  return {
    id: newProductId(),
    sourceUrl: p.sourceUrl,
    name: p.name,
    collectionKind: p.collectionKind ?? "jersey",
    imageUrls: p.imageUrls,
    scrapeError:
      p.error ??
      (p.imageUrls.length === 0 ? "Aucune image — importez manuellement." : null),
    selections,
    categoryGroupId: "",
    categoryDivisionId: null,
    categoryId,
    suggestedCategoryId: suggestedId || null,
    suggestedCategoryLabel: asTrimmedString(p.suggestedCategoryLabel) || null,
    suggestedCategoryReason: asTrimmedString(p.suggestedCategoryReason) || null,
    pushResult: null,
    modifiedAt: Date.now(),
  };
}

async function importImagesFromFiles(
  product: StudioProduct,
  files: File[],
  updateProduct: (id: string, patch: Partial<StudioProduct>) => void,
  setError: (msg: string | null) => void,
): Promise<void> {
  const imageFiles = files.filter((f) => f.type.startsWith("image/"));
  if (!imageFiles.length) return;

  let nextSelections = product.selections;
  for (const file of imageFiles) {
    try {
      const { base64, preview } = await readImageFile(file);
      const selectionId = newSelectionId();
      await putManualImage(selectionId, base64, preview);
      nextSelections = [
        ...nextSelections,
        {
          id: selectionId,
          kind: "manual",
          manualBase64: base64,
          manualPreview: preview,
          mode: "uniform",
          renderPreview: null,
          renderError: null,
        },
      ];
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import impossible.");
      break;
    }
  }

  updateProduct(product.id, {
    selections: nextSelections,
    pushResult: null,
  });
}

function scrapedSelectionKey(url: string) {
  return `scraped:${url}`;
}

function isScrapedSelected(product: StudioProduct, url: string) {
  return product.selections.some((s) => s.kind === "scraped" && s.url === url);
}

function toggleScrapedImage(product: StudioProduct, url: string): StudioImageSelection[] {
  const existing = product.selections.find((s) => s.kind === "scraped" && s.url === url);
  if (existing) {
    return product.selections.filter((s) => s.id !== existing.id);
  }

  return [
    ...product.selections,
    {
      id: newSelectionId(),
      kind: "scraped",
      url,
      mode: "uniform" as const,
      renderPreview: null,
      renderError: null,
    },
  ];
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Lecture du rendu impossible."));
    };
    reader.onerror = () => reject(new Error("Lecture du rendu impossible."));
    reader.readAsDataURL(blob);
  });
}

/** Réponse render : PNG binaire (succès) ou JSON (erreur). */
async function parseRenderResponse(res: Response): Promise<string> {
  const contentType = res.headers.get("content-type") ?? "";

  if (contentType.includes("image/png")) {
    if (!res.ok) {
      throw new Error(`Rendu échoué (${res.status}).`);
    }
    return blobToDataUrl(await res.blob());
  }

  const data = await readApiJson<{
    ok?: boolean;
    message?: string;
    imageBase64?: string;
  }>(res);

  if (res.ok && data.imageBase64) {
    return `data:image/png;base64,${data.imageBase64}`;
  }

  throw new Error(data.message ?? `Rendu échoué (${res.status}).`);
}

/** Parse JSON depuis une Response — évite « Unexpected end of JSON input ». */
async function readApiJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(
      res.status === 413
        ? "Image trop volumineuse pour le serveur."
        : res.status >= 500
          ? "Erreur serveur — réessayez."
          : "Réponse serveur vide.",
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Réponse serveur invalide.");
  }
}

function updateSelection(
  selections: StudioImageSelection[],
  selectionId: string,
  patch: Partial<StudioImageSelection>,
): StudioImageSelection[] {
  return selections.map((s) =>
    s.id === selectionId
      ? {
          ...s,
          ...patch,
          renderPreview:
            patch.mode !== undefined && patch.mode !== s.mode ? null : patch.renderPreview ?? s.renderPreview,
          renderError:
            patch.mode !== undefined && patch.mode !== s.mode ? null : patch.renderError ?? s.renderError,
        }
      : s,
  );
}

function removeSelection(selections: StudioImageSelection[], selectionId: string) {
  return selections.filter((s) => s.id !== selectionId);
}

function selectionOrderNumber(product: StudioProduct, selectionId: string): number {
  const index = product.selections.findIndex((s) => s.id === selectionId);
  return index >= 0 ? index + 1 : 0;
}

function scrapedOrderNumber(product: StudioProduct, url: string): number {
  const selection = product.selections.find((s) => s.kind === "scraped" && s.url === url);
  if (!selection) return 0;
  return selectionOrderNumber(product, selection.id);
}

function moveSelection(
  selections: StudioImageSelection[],
  selectionId: string,
  direction: -1 | 1,
): StudioImageSelection[] {
  const index = selections.findIndex((s) => s.id === selectionId);
  if (index < 0) return selections;
  const target = index + direction;
  if (target < 0 || target >= selections.length) return selections;

  const next = selections.slice();
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item!);
  return next;
}

function draftToProduct(product: PersistedStudioProduct): StudioProduct {
  return {
    ...product,
    selections: product.selections.map((selection) => ({
      id: selection.id,
      kind: selection.kind,
      url: selection.url,
      mode: "uniform",
      manualBase64: undefined,
      manualPreview: undefined,
      renderPreview: null,
      renderError: selection.renderError ?? null,
    })),
  };
}

function productToDraft(product: StudioProduct): PersistedStudioProduct {
  return {
    id: product.id,
    sourceUrl: product.sourceUrl,
    name: product.name,
    collectionKind: product.collectionKind,
    imageUrls: product.imageUrls,
    scrapeError: product.scrapeError,
    selections: product.selections.map((selection) => ({
      id: selection.id,
      kind: selection.kind,
      url: selection.url,
      mode: "uniform",
      renderPreview: null,
      renderError: selection.renderError,
    })),
    categoryGroupId: product.categoryGroupId,
    categoryDivisionId: product.categoryDivisionId,
    categoryId: product.categoryId,
    suggestedCategoryId: product.suggestedCategoryId,
    suggestedCategoryLabel: product.suggestedCategoryLabel,
    suggestedCategoryReason: product.suggestedCategoryReason,
    pushResult: product.pushResult,
    modifiedAt: product.modifiedAt,
  };
}

export function JerseyStudioSection({ secret }: { secret: string }) {
  const topRef = useRef<HTMLDivElement>(null);
  const productRefs = useRef(new Map<string, HTMLElement | null>());
  const restoredDraftRef = useRef(false);

  const [urlsText, setUrlsText] = useState("");
  const [price, setPrice] = useState("24.99");
  const [stock, setStock] = useState("20");
  const [categoryOptGroups, setCategoryOptGroups] = useState<AdminCategoryOptGroup[]>([]);
  const [defaultCategoryId, setDefaultCategoryId] = useState("");
  const [products, setProducts] = useState<StudioProduct[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scrapeProgress, setScrapeProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [brokenLinks, setBrokenLinks] = useState<BrokenScrapeLink[]>([]);
  const [nameCopiedId, setNameCopiedId] = useState<string | null>(null);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const [draftLiteSave, setDraftLiteSave] = useState(false);
  const [lastModifiedProductId, setLastModifiedProductId] = useState<string | null>(null);
  const [restoreNotice, setRestoreNotice] = useState<string | null>(null);

  const parsedUrls = useMemo(() => parseSourceUrls(urlsText), [urlsText]);

  useEffect(() => {
    void (async () => {
      const draft = loadStudioDraft();
      if (draft) {
        restoredDraftRef.current = true;
        setUrlsText(draft.urlsText);
        setPrice(draft.price);
        setStock(draft.stock);
        setDefaultCategoryId(draft.defaultCategoryId);
        setBrokenLinks(draft.brokenLinks);
        const restored = await Promise.all(
          draft.products.map(async (product) => {
            const base = draftToProduct(product);
            const selections = await hydrateManualSelections(base.selections);
            return { ...base, selections };
          }),
        );
        setProducts(restored);
        setLastModifiedProductId(draft.lastModifiedProductId);
        setDraftSavedAt(draft.savedAt);
        const count = draft.products.length;
        const manualCount = restored.reduce(
          (n, p) => n + p.selections.filter((s) => s.kind === "manual").length,
          0,
        );
        if (count > 0) {
          setRestoreNotice(
            manualCount > 0
              ? `Session restaurée — ${count} produit(s), ${manualCount} import(s) local(aux) rechargé(s).`
              : `Session restaurée — ${count} produit(s), sélections et réglages conservés.`,
          );
        }
      }
      setDraftHydrated(true);
    })();
  }, []);

  useEffect(() => {
    if (!draftHydrated) return;

    const timer = window.setTimeout(() => {
      const manualIds = products.flatMap((p) =>
        p.selections.filter((s) => s.kind === "manual").map((s) => s.id),
      );
      void pruneManualImages(manualIds);

      const result = saveStudioDraft({
        version: 1,
        savedAt: Date.now(),
        urlsText,
        price,
        stock,
        defaultCategoryId,
        brokenLinks,
        products: products.map(productToDraft),
        lastModifiedProductId,
      });
      if (result.ok) {
        setDraftSavedAt(Date.now());
        setDraftLiteSave(result.lite);
      }
    }, 700);

    return () => window.clearTimeout(timer);
  }, [
    draftHydrated,
    urlsText,
    price,
    stock,
    defaultCategoryId,
    brokenLinks,
    products,
    lastModifiedProductId,
  ]);

  const scrollToTop = useCallback(() => {
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const scrollToLastModified = useCallback(() => {
    const targetId =
      lastModifiedProductId && products.some((p) => p.id === lastModifiedProductId)
        ? lastModifiedProductId
        : products[products.length - 1]?.id;
    if (!targetId) return;
    productRefs.current.get(targetId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [lastModifiedProductId, products]);

  useEffect(() => {
    void (async () => {
      setLoadingCategories(true);
      try {
        const res = await fetch("/api/admin/jersey-studio", {
          headers: { Authorization: `Bearer ${secret}` },
        });
        if (!res.ok) throw new Error("Catégories indisponibles.");
        const data = (await res.json()) as {
          categories: CategoryOption[];
          categoryGroups?: AdminCategoryOptGroup[];
          defaultCategoryId?: string;
          defaultPrice?: number;
          defaultStock?: number;
        };
        const optGroups =
          data.categoryGroups ??
          buildAdminCategoryOptGroups(data.categories ?? []);
        setCategoryOptGroups(optGroups);

        const flat = flattenAdminCategoryOptGroups(optGroups);
        const configured = data.defaultCategoryId ?? "";
        const pick =
          flat.find((o) => o.id === configured)?.id ??
          flat[0]?.id ??
          configured;
        if (!restoredDraftRef.current) {
          setDefaultCategoryId(pick);
          if (typeof data.defaultPrice === "number") {
            setPrice(String(data.defaultPrice));
          }
          if (typeof data.defaultStock === "number") {
            setStock(String(data.defaultStock));
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur catégories.");
      } finally {
        setLoadingCategories(false);
      }
    })();
  }, [secret]);

  async function scrapeBatch() {
    if (!parsedUrls.length) {
      setError("Collez au moins un lien produit.");
      return;
    }

    setBusy(true);
    setError(null);
    setProducts([]);
    setBrokenLinks([]);
    setLastModifiedProductId(null);
    setScrapeProgress({ done: 0, total: parsedUrls.length });

    const flatCategories = flattenAdminCategoryOptGroups(categoryOptGroups);
    const accumulated: StudioProduct[] = [];
    const broken: BrokenScrapeLink[] = [];

    try {
      for (let i = 0; i < parsedUrls.length; i++) {
        const url = parsedUrls[i]!;
        setPhase(`Analyse des liens… ${i + 1} / ${parsedUrls.length}`);
        setScrapeProgress({ done: i, total: parsedUrls.length });

        try {
          const res = await fetch("/api/admin/jersey-studio", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${secret}`,
            },
            body: JSON.stringify({ action: "scrape_batch", urls: [url] }),
          });
          const data = (await res.json()) as {
            ok?: boolean;
            message?: string;
            products?: ScrapedApiProduct[];
          };
          if (!res.ok) {
            throw new Error(data.message ?? "Scrape échoué.");
          }

          const scraped = data.products?.[0];
          if (!scraped) {
            broken.push({ url, error: "Réponse vide du serveur." });
          } else if (isBrokenScrape(scraped)) {
            broken.push({
              url: scraped.sourceUrl || url,
              error: scraped.error ?? "Aucune image trouvée sur la page.",
            });
          } else {
            const product = mapScrapedApiProduct(
              scraped,
              flatCategories,
              defaultCategoryId,
            );
            accumulated.push(product);
            setLastModifiedProductId(product.id);
            setProducts([...accumulated]);
          }
        } catch (err) {
          broken.push({
            url,
            error: err instanceof Error ? err.message : "scrape_failed",
          });
        }

        setScrapeProgress({ done: i + 1, total: parsedUrls.length });
        setBrokenLinks([...broken]);
      }


      if (!accumulated.length && broken.length) {
        setError(
          `${broken.length} lien(s) en échec — consultez la liste ci-dessous.`,
        );
      } else if (broken.length) {
        setError(
          `${accumulated.length} produit(s) OK · ${broken.length} lien(s) en échec.`,
        );
      }
      setPhase(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scrape échoué.");
      setPhase(null);
    } finally {
      setBusy(false);
      setScrapeProgress(null);
    }
  }

  function updateProduct(id: string, patch: Partial<StudioProduct>) {
    setLastModifiedProductId(id);
    setProducts((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, ...patch, modifiedAt: Date.now() } : p,
      ),
    );
  }

  function touchProduct(id: string, updater: (product: StudioProduct) => StudioProduct) {
    setLastModifiedProductId(id);
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...updater(p), modifiedAt: Date.now() } : p)),
    );
  }

  async function renderAll() {
    const jobs = products.flatMap((product) =>
      product.selections.map((selection) => ({
        productId: product.id,
        productName: product.name,
        sourceUrl: product.sourceUrl,
        selectionId: selection.id,
        selection,
      })),
    );

    if (!jobs.length) {
      setError("Sélectionnez ou importez au moins une image par produit.");
      return;
    }

    setBusy(true);
    setError(null);

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i]!;
      const label =
        job.selection.kind === "scraped"
          ? `${job.productName.slice(0, 30)} (#${i + 1})`
          : `${job.productName.slice(0, 24)} (import #${i + 1})`;
      setPhase(`Rendu ${i + 1}/${jobs.length} — ${label}…`);

      touchProduct(job.productId, (p) => ({
        ...p,
        selections: updateSelection(p.selections, job.selectionId, {
          renderPreview: null,
          renderError: null,
        }),
      }));

      try {
        const body: Record<string, string> = {
          action: "render",
          renderMode: "uniform",
        };
        if (job.selection.manualBase64) {
          body.imageBase64 = job.selection.manualBase64;
        } else if (job.selection.url) {
          body.imageUrl = job.selection.url;
          body.referer = job.sourceUrl;
        } else {
          throw new Error("Aucune image sélectionnée.");
        }

        const res = await fetch("/api/admin/jersey-studio", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${secret}`,
          },
          body: JSON.stringify(body),
        });
        const renderPreview = await parseRenderResponse(res);

        touchProduct(job.productId, (p) => ({
          ...p,
          selections: updateSelection(p.selections, job.selectionId, {
            renderPreview,
            renderError: null,
          }),
        }));
      } catch (err) {
        touchProduct(job.productId, (p) => ({
          ...p,
          selections: updateSelection(p.selections, job.selectionId, {
            renderError: err instanceof Error ? err.message : "Rendu échoué.",
          }),
        }));
      }
    }

    setPhase(null);
    setBusy(false);
  }

  async function pushAll() {
    const ready = products.filter((p) =>
      p.selections.some((s) => s.renderPreview),
    );
    if (!ready.length) {
      setError("Rendez les images avant l'envoi PrestaShop.");
      return;
    }

    const numericPrice = Number.parseFloat(price.replace(",", "."));
    const numericStock = Number.parseInt(stock, 10);
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      setError("Prix invalide.");
      return;
    }
    if (!Number.isFinite(numericStock) || numericStock < 0) {
      setError("Stock invalide.");
      return;
    }

    setBusy(true);
    setError(null);

    let okCount = 0;
    let failCount = 0;

    try {
      for (let i = 0; i < ready.length; i++) {
        const p = ready[i]!;
        const productIndex = products.findIndex((item) => item.id === p.id) + 1;
        setPhase(
          `Envoi PrestaShop ${i + 1}/${ready.length} — produit #${productIndex}…`,
        );

        const item = {
          clientId: p.id,
          name: p.name.trim(),
          categoryId: p.categoryId,
          sourceUrl: p.sourceUrl,
          imagesBase64: p.selections
            .filter((s) => s.renderPreview)
            .map((s) => s.renderPreview!.split(",")[1] ?? "")
            .filter(Boolean),
        };

        const res = await fetch("/api/admin/jersey-studio", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${secret}`,
          },
          body: JSON.stringify({
            action: "push_batch",
            price: numericPrice,
            stock: numericStock,
            items: [item],
          }),
        });

        let data: {
          ok?: boolean;
          message?: string;
          results?: {
            clientId?: string;
            name: string;
            ok: boolean;
            productId?: string;
            error?: string;
          }[];
        };

        try {
          data = (await res.json()) as typeof data;
        } catch {
          throw new Error(
            res.status === 413
              ? "Payload trop volumineux — réessayez avec moins d'images par produit."
              : "Réponse serveur invalide (invalid_body). Réessayez produit par produit.",
          );
        }

        if (!res.ok) {
          const result = data.results?.[0];
          updateProduct(p.id, {
            pushResult: {
              ok: false,
              error: result?.error ?? data.message ?? "Envoi échoué.",
            },
          });
          failCount++;
          continue;
        }

        const result = data.results?.[0];
        updateProduct(p.id, {
          pushResult: {
            ok: result?.ok ?? false,
            productId: result?.productId,
            error: result?.error,
          },
        });
        if (result?.ok) okCount++;
        else failCount++;
      }

      if (failCount > 0) {
        setError(`${okCount} produit(s) envoyé(s) · ${failCount} échec(s).`);
      }
      setPhase(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Envoi échoué.");
      setPhase(null);
    } finally {
      setBusy(false);
    }
  }

  const totalSelections = products.reduce((n, p) => n + p.selections.length, 0);
  const renderedCount = products.reduce(
    (n, p) => n + p.selections.filter((s) => s.renderPreview).length,
    0,
  );
  const renderFailedCount = products.reduce(
    (n, p) => n + p.selections.filter((s) => s.renderError).length,
    0,
  );
  const readyToPush = products.filter(
    (p) => p.selections.some((s) => s.renderPreview) && !p.pushResult?.ok,
  ).length;

  return (
    <section className="relative mt-16 rounded-3xl border border-accent/25 bg-accent/[0.03] p-6 lg:p-8">
      <div ref={topRef} className="scroll-mt-24" />
      <h2 className="font-display text-xl font-semibold">Studio Footshop</h2>
      <p className="mt-1 text-sm text-ink/55">
        Scrape, rendu maillot / short / détail et envoi PrestaShop.
      </p>
      <p className="mt-2 text-sm text-ink/55">
        Collez des liens produit, sélectionnez une ou plusieurs images (clic = basculer),
        rendez-les (fond <code className="text-xs">#161616</code> + halo · 656×822 px), vérifiez
        le nom et la catégorie, puis envoyez sur PrestaShop. Le type <strong>Maillot</strong> ou{" "}
        <strong>Short</strong> est détecté automatiquement. La catégorie est suggérée depuis le{" "}
        <strong>titre</strong> et l&apos;<strong>URL</strong> (ligue, CDM 2026, sélection…).
      </p>

      {restoreNotice ? (
        <p className="mt-3 rounded-xl border border-accent/20 bg-white/80 px-3 py-2 text-xs text-ink/65">
          {restoreNotice}
        </p>
      ) : null}
      {draftSavedAt && draftHydrated ? (
        <p className="mt-2 text-[11px] text-ink/40">
          Progression sauvegardée automatiquement
          {draftLiteSave
            ? " (aperçus de rendu exclus — relancez « Rendre les images » si besoin)."
            : "."}
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field
          label="Prix (€) — tous les produits"
          name="studioPrice"
          type="number"
          min="0"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        <Field
          label="Stock par taille"
          name="studioStock"
          type="number"
          min="0"
          step="1"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
        />
      </div>

      <div className="mt-4">
        <label className="mb-1.5 block text-xs font-medium text-ink/70">
          Catégorie PrestaShop par défaut
        </label>
        <p className="mb-2 text-[11px] text-ink/45">
          Catégories réelles de votre boutique (IDs PrestaShop) — pas les filtres du site.
        </p>
        <CategorySelect
          optGroups={categoryOptGroups}
          value={defaultCategoryId}
          disabled={loadingCategories}
          onChange={(categoryId) => {
            setDefaultCategoryId(categoryId);
            setProducts((prev) => prev.map((p) => ({ ...p, categoryId })));
          }}
        />
      </div>

      <div className="mt-6">
        <TextareaField
          label="Liens produit (un par ligne)"
          name="studioUrls"
          value={urlsText}
          onChange={(e) => setUrlsText(e.target.value)}
          placeholder="https://www.unisportstore.fr/…"
          rows={4}
        />
        <p className="mt-1 text-xs text-ink/45">
          {parsedUrls.length} lien(s) détecté(s)
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <Button type="button" onClick={scrapeBatch} disabled={busy || !parsedUrls.length}>
          {busy && phase?.startsWith("Analyse") ? (
            <Spinner className="h-4 w-4" />
          ) : (
            "1. Analyser les liens"
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={renderAll}
          disabled={busy || totalSelections === 0}
        >
          {busy && phase?.startsWith("Rendu") ? (
            <Spinner className="h-4 w-4" />
          ) : (
            `2. Rendre les images (${totalSelections})`
          )}
        </Button>
        <Button
          type="button"
          className="bg-[#1a7f37] hover:bg-[#156b2e]"
          onClick={pushAll}
          disabled={busy || renderedCount === 0}
        >
          {busy && phase?.startsWith("Envoi") ? (
            <Spinner className="h-4 w-4" />
          ) : (
            `3. Envoyer PrestaShop (${readyToPush || products.filter((p) => p.selections.some((s) => s.renderPreview)).length})`
          )}
        </Button>
      </div>

      {phase ? <p className="mt-3 text-sm text-ink/60">{phase}</p> : null}
      {products.length > 0 ? (
        <p className="mt-3 text-xs text-ink/50">
          {products.length} produit(s) · {totalSelections} image(s) sélectionnée(s) ·{" "}
          {renderedCount} rendue(s)
          {renderFailedCount > 0 ? ` · ${renderFailedCount} échec(s) de rendu` : ""}
        </p>
      ) : null}
      {scrapeProgress ? (
        <div className="mt-3">
          <p className="text-xs font-medium text-ink/55">
            {scrapeProgress.done} / {scrapeProgress.total} lien(s) analysé(s)
          </p>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink/10">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300"
              style={{
                width: `${Math.round((scrapeProgress.done / scrapeProgress.total) * 100)}%`,
              }}
            />
          </div>
        </div>
      ) : null}
      {error ? <p className="mt-3 text-sm text-accent">{error}</p> : null}

      {brokenLinks.length > 0 ? (
        <div className="mt-6 rounded-2xl border border-accent/25 bg-accent/[0.04] p-4">
          <h3 className="text-sm font-semibold text-ink">
            Liens en échec ({brokenLinks.length})
          </h3>
          <p className="mt-1 text-xs text-ink/50">
            Ces URLs n&apos;ont pas pu être importées (page bloquée, produit introuvable,
            aucune image, etc.). Corrigez ou importez-les manuellement.
          </p>
          <ul className="mt-3 max-h-56 space-y-2 overflow-y-auto">
            {brokenLinks.map((item) => (
              <li
                key={item.url}
                className="rounded-xl border border-ink/8 bg-white/80 px-3 py-2 text-xs"
              >
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate font-medium text-accent underline-offset-2 hover:underline"
                >
                  {item.url}
                </a>
                <p className="mt-1 text-ink/55">{item.error}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {products.length > 0 ? (
        <div className="mt-8 space-y-8">
          {products.map((product, productIndex) => (
            <article
              key={product.id}
              ref={(node) => {
                productRefs.current.set(product.id, node);
              }}
              className="scroll-mt-24 rounded-2xl border border-ink/8 bg-white/70 p-4 lg:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">
                      {productIndex + 1}
                    </span>
                    <p className="text-xs uppercase tracking-widest text-ink/40">
                      Produit #{productIndex + 1}
                    </p>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={product.name}
                      onChange={(e) =>
                        updateProduct(product.id, {
                          name: e.target.value,
                          pushResult: null,
                        })
                      }
                      className="min-w-0 flex-1 rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm font-medium text-ink"
                      aria-label="Nom du produit"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(product.name);
                        setNameCopiedId(product.id);
                        window.setTimeout(() => setNameCopiedId(null), 1600);
                      }}
                      className="shrink-0 rounded-lg border border-ink/10 bg-white px-3 py-2 text-xs font-medium text-ink/65 hover:bg-ink/[0.03]"
                    >
                      {nameCopiedId === product.id ? "Copié" : "Copier"}
                    </button>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                        product.collectionKind === "short"
                          ? "bg-amber-100 text-amber-900"
                          : "bg-sky-100 text-sky-900",
                      )}
                    >
                      {product.collectionKind === "short" ? "Short" : "Maillot"}
                    </span>
                  </div>
                  <a
                    href={product.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block truncate text-xs text-accent underline-offset-2 hover:underline"
                  >
                    {product.sourceUrl}
                  </a>
                  {product.scrapeError ? (
                    <p className="mt-2 text-xs text-accent">
                      Scrape : {product.scrapeError} — importez une image manuellement.
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
                <div className="hidden w-full sm:max-w-md" />
                <div className="w-full sm:max-w-md sm:ml-auto">
                  <label className="mb-1 block text-xs font-medium text-ink/60">
                    Catégorie PrestaShop
                  </label>
                  <CategorySelect
                    optGroups={categoryOptGroups}
                    value={product.categoryId || defaultCategoryId}
                    disabled={loadingCategories}
                    onChange={(categoryId) =>
                      updateProduct(product.id, { categoryId })
                    }
                  />
                  {product.suggestedCategoryLabel ? (
                    <p
                      className={cn(
                        "mt-1 text-xs",
                        product.categoryId === product.suggestedCategoryId
                          ? "text-accent/80"
                          : "text-ink/40",
                      )}
                    >
                      {product.categoryId === product.suggestedCategoryId
                        ? "Suggestion"
                        : "Suggestion initiale"}
                      {" : "}
                      {product.suggestedCategoryLabel}
                      {product.suggestedCategoryReason
                        ? ` (${product.suggestedCategoryReason})`
                        : ""}
                    </p>
                  ) : null}
                </div>
              </div>

              {product.imageUrls.length > 0 ? (
                <div className="mt-4">
                  <p className="text-xs font-medium text-ink/50">
                    Images scrappées — cliquez pour sélectionner / désélectionner. Le numéro
                    indique l&apos;ordre d&apos;envoi (#1 = image principale).
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                    {product.imageUrls.map((url) => {
                      const selected = isScrapedSelected(product, url);
                      const order = scrapedOrderNumber(product, url);
                      return (
                        <button
                          key={scrapedSelectionKey(url)}
                          type="button"
                          onClick={() => {
                            touchProduct(product.id, (p) => ({
                              ...p,
                              selections: toggleScrapedImage(p, url),
                              pushResult: null,
                            }));
                          }}
                          className={cn(
                            "relative aspect-[4/5] overflow-hidden rounded-lg border-2 bg-[#161616]",
                            selected
                              ? "border-accent ring-2 ring-accent/30"
                              : "border-transparent opacity-80 hover:opacity-100",
                          )}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt=""
                            className="h-full w-full object-contain p-1"
                            loading="lazy"
                          />
                          {selected && order > 0 ? (
                            <span className="absolute left-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-white shadow">
                              {order}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className="mt-4">
                <label className="text-xs font-medium text-ink/50">
                  Importer des images (glisser-déposer, coller ou fichier)
                </label>
                <div
                  tabIndex={0}
                  className="mt-2 rounded-xl border border-dashed border-ink/15 bg-white/60 px-4 py-6 text-center outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/20"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void importImagesFromFiles(
                      product,
                      Array.from(e.dataTransfer.files),
                      updateProduct,
                      setError,
                    );
                  }}
                  onPaste={(e) => {
                    const files: File[] = [];
                    for (const item of Array.from(e.clipboardData.items)) {
                      if (item.type.startsWith("image/")) {
                        const file = item.getAsFile();
                        if (file) files.push(file);
                      }
                    }
                    if (!files.length) return;
                    e.preventDefault();
                    void importImagesFromFiles(product, files, updateProduct, setError);
                  }}
                >
                  <p className="text-xs text-ink/55">
                    Déposez des images ici, cliquez puis <kbd className="rounded bg-ink/5 px-1">Ctrl+V</kbd>{" "}
                    pour coller, ou choisissez des fichiers.
                  </p>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="mt-3 block w-full text-xs"
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? []);
                      e.target.value = "";
                      if (!files.length) return;
                      void importImagesFromFiles(product, files, updateProduct, setError);
                    }}
                  />
                </div>
              </div>

              {product.selections.length > 0 ? (
                <div className="mt-4 space-y-3">
                  <p className="text-xs font-medium text-ink/50">
                    Images sélectionnées ({product.selections.length})
                  </p>
                  {product.selections.map((selection, selectionIndex) => {
                    const order = selectionIndex + 1;
                    return (
                    <div
                      key={selection.id}
                      className="rounded-xl border border-ink/8 bg-white/80 p-3"
                    >
                      <div className="flex flex-wrap items-start gap-3">
                        <div className="relative w-20 shrink-0 overflow-hidden rounded-lg border border-ink/10 bg-[#161616]">
                          <span className="absolute left-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-white shadow">
                            {order}
                          </span>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={
                              selection.manualPreview ??
                              selection.url ??
                              undefined
                            }
                            alt=""
                            className="aspect-[4/5] w-full object-contain"
                          />
                          {selection.kind === "manual" &&
                          !selection.manualPreview &&
                          !selection.manualBase64 ? (
                            <span className="absolute inset-0 flex items-center justify-center bg-ink/5 px-1 text-center text-[10px] text-ink/45">
                              Image locale introuvable — réimportez
                            </span>
                          ) : null}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-ink/55">
                            Image #{order} —{" "}
                            {selection.kind === "manual" ? "Import local" : "Image scrappée"}
                            {order === 1 ? " · couverture PrestaShop" : " · galerie"}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="text-[11px] text-ink/45">Ordre :</span>
                            <button
                              type="button"
                              disabled={busy || order <= 1}
                              onClick={() =>
                                updateProduct(product.id, {
                                  selections: moveSelection(product.selections, selection.id, -1),
                                  pushResult: null,
                                })
                              }
                              className="rounded-lg bg-ink/5 px-2 py-1 text-xs text-ink/60 hover:bg-ink/10 disabled:opacity-40"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              disabled={busy || order >= product.selections.length}
                              onClick={() =>
                                updateProduct(product.id, {
                                  selections: moveSelection(product.selections, selection.id, 1),
                                  pushResult: null,
                                })
                              }
                              className="rounded-lg bg-ink/5 px-2 py-1 text-xs text-ink/60 hover:bg-ink/10 disabled:opacity-40"
                            >
                              ↓
                            </button>
                            <span className="text-[11px] text-ink/45">Rendu :</span>
                            <span className="rounded-lg bg-accent px-2.5 py-1 text-xs font-medium text-white">
                              Maillot uniforme
                            </span>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => {
                                void deleteManualImage(selection.id);
                                updateProduct(product.id, {
                                  selections: removeSelection(product.selections, selection.id),
                                  pushResult: null,
                                });
                              }}
                              className="ml-auto text-xs text-accent underline-offset-2 hover:underline"
                            >
                              Retirer
                            </button>
                          </div>
                          {selection.renderError ? (
                            <p className="mt-2 text-xs text-accent">
                              Rendu : {selection.renderError}
                            </p>
                          ) : null}
                        </div>

                        {selection.renderPreview ? (
                          <div className="w-full sm:w-auto">
                            <p className="mb-1 text-[11px] text-ink/45">Aperçu rendu</p>
                            <div className="inline-flex overflow-hidden rounded-lg border border-ink/10 bg-[#161616] p-2">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={selection.renderPreview}
                                alt=""
                                className="h-[120px] w-[96px] object-contain sm:h-[205px] sm:w-[164px]"
                              />
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-4 text-xs text-ink/45">
                  Sélectionnez au moins une image scrappée ou importez un fichier.
                </p>
              )}

              {product.pushResult ? (
                <p
                  className={cn(
                    "mt-3 text-xs font-medium",
                    product.pushResult.ok ? "text-[#1a7f37]" : "text-accent",
                  )}
                >
                  {product.pushResult.ok
                    ? `Envoyé ✓ (#${product.pushResult.productId})`
                    : `Échec envoi : ${product.pushResult.error}`}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}

      {products.length > 0 ? (
        <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col gap-2">
          <Button
            type="button"
            variant="secondary"
            className="pointer-events-auto shadow-lg"
            onClick={scrollToTop}
          >
            ↑ Haut — analyser les liens
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="pointer-events-auto shadow-lg"
            onClick={scrollToLastModified}
            disabled={!products.length}
          >
            ↓ Dernier modifié
          </Button>
        </div>
      ) : null}
    </section>
  );
}

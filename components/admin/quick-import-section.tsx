"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AdminCategoryPicker } from "@/components/admin/admin-category-picker";
import { ImportLinkAlerts } from "@/components/admin/import-link-alerts";
import { PushFailuresAlert } from "@/components/admin/push-failures-alert";
import { Button } from "@/components/ui/button";
import { Field, TextareaField } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import {
  buildAdminCategoryOptGroups,
  flattenAdminCategoryOptGroups,
  type AdminCategoryOptGroup,
} from "@/lib/admin/import-category-tree";
import type { ProductCollectionKind } from "@/lib/product-collection";
import { autoSelectJerseyImageUrls } from "@/lib/jersey-studio/auto-select-images";
import {
  readAutoSelectImagesPreference,
  writeAutoSelectImagesPreference,
} from "@/lib/jersey-studio/auto-select-preference";
import { parseSourceUrls } from "@/lib/product-import/parse-urls";
import {
  loadQuickImportDraft,
  saveQuickImportDraft,
  type QuickImportDraft,
} from "@/lib/quick-import/quick-import-storage";
import { cn } from "@/lib/utils";

const LEGACY_SESSION_KEY = "maillot-store-quick-import-session-v1";

type CategoryOption = { id: string; name: string; parentId?: string | null };

type QuickProduct = {
  id: string;
  sourceUrl: string;
  name: string;
  collectionKind: ProductCollectionKind;
  imageUrls: string[];
  selectedUrls: string[];
  scrapeError: string | null;
  categoryId: string;
  suggestedCategoryId: string | null;
  suggestedCategoryLabel: string | null;
  suggestedCategoryReason: string | null;
  pushResult: { ok: boolean; productId?: string; error?: string } | null;
};

type ScrapedApiProduct = {
  sourceUrl: string;
  name: string;
  collectionKind?: ProductCollectionKind;
  imageUrls: string[];
  suggestedCategoryId?: unknown;
  suggestedCategoryLabel?: unknown;
  suggestedCategoryReason?: unknown;
  error?: string;
};

type BrokenLink = { url: string; error: string };

function migrateLegacySession(): QuickImportDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(LEGACY_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Omit<QuickImportDraft, "version" | "savedAt">;
    window.sessionStorage.removeItem(LEGACY_SESSION_KEY);
    return {
      version: 3,
      savedAt: Date.now(),
      urlsText: parsed.urlsText ?? "",
      price: parsed.price ?? "25.99",
      stock: parsed.stock ?? "20",
      defaultCategoryId: parsed.defaultCategoryId ?? "",
      products: (parsed.products ?? []).map((p) => ({ ...p, pushResult: null })),
      brokenLinks: parsed.brokenLinks ?? [],
    };
  } catch {
    return null;
  }
}

async function readImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Lecture image impossible."));
    };
    reader.onerror = () => reject(new Error("Lecture image impossible."));
    reader.readAsDataURL(file);
  });
}

async function importPastedImages(
  product: QuickProduct,
  files: File[],
  updateProduct: (id: string, patch: Partial<QuickProduct>) => void,
): Promise<number> {
  const imageFiles = files.filter((f) => f.type.startsWith("image/"));
  if (!imageFiles.length) return 0;

  const added: string[] = [];
  for (const file of imageFiles) {
    const dataUrl = await readImageFile(file);
    added.push(dataUrl);
  }

  updateProduct(product.id, {
    imageUrls: [...product.imageUrls, ...added],
    selectedUrls: [...product.selectedUrls, ...added],
    pushResult: null,
  });
  return added.length;
}

function loadInitialDraft(): QuickImportDraft | null {
  return loadQuickImportDraft() ?? migrateLegacySession();
}

function newProductId() {
  return `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function asTrimmedString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function mapScrapedProduct(
  p: ScrapedApiProduct,
  flatCategories: { id: string }[],
  defaultCategoryId: string,
  autoSelectImages: boolean,
): QuickProduct {
  const suggestedId = asTrimmedString(p.suggestedCategoryId);
  const categoryId =
    suggestedId && flatCategories.some((o) => o.id === suggestedId)
      ? suggestedId
      : defaultCategoryId;

  const selectedUrls =
    autoSelectImages && p.imageUrls.length > 0
      ? autoSelectJerseyImageUrls(p.imageUrls, {
          title: p.name,
          sourceUrl: p.sourceUrl,
        })
      : [];

  return {
    id: newProductId(),
    sourceUrl: p.sourceUrl,
    name: p.name,
    collectionKind: p.collectionKind ?? "jersey",
    imageUrls: p.imageUrls,
    selectedUrls,
    scrapeError:
      p.error ??
      (p.imageUrls.length === 0 ? "Aucune image — lien invalide ou page bloquée." : null),
    categoryId,
    suggestedCategoryId: suggestedId || null,
    suggestedCategoryLabel: asTrimmedString(p.suggestedCategoryLabel) || null,
    suggestedCategoryReason: asTrimmedString(p.suggestedCategoryReason) || null,
    pushResult: null,
  };
}

function toggleImageUrl(product: QuickProduct, url: string): QuickProduct {
  const selected = product.selectedUrls.includes(url);
  return {
    ...product,
    selectedUrls: selected
      ? product.selectedUrls.filter((u) => u !== url)
      : [...product.selectedUrls, url],
    pushResult: null,
  };
}

function imageOrder(product: QuickProduct, url: string): number {
  const index = product.selectedUrls.indexOf(url);
  return index >= 0 ? index + 1 : 0;
}

export function QuickImportSection({ secret }: { secret: string }) {
  const saved = loadInitialDraft();
  const [urlsText, setUrlsText] = useState(saved?.urlsText ?? "");
  const [price, setPrice] = useState(saved?.price ?? "25.99");
  const [stock, setStock] = useState(saved?.stock ?? "20");
  const [defaultCategoryId, setDefaultCategoryId] = useState(
    saved?.defaultCategoryId ?? "",
  );
  const [categoryOptGroups, setCategoryOptGroups] = useState<AdminCategoryOptGroup[]>(
    [],
  );
  const [products, setProducts] = useState<QuickProduct[]>(
    (saved?.products as QuickProduct[]) ?? [],
  );
  const [brokenLinks, setBrokenLinks] = useState<BrokenLink[]>(
    saved?.brokenLinks ?? [],
  );
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(saved?.savedAt ?? null);
  const [restoreNotice, setRestoreNotice] = useState<string | null>(() => {
    if (!saved) return null;
    const count = saved.products.length;
    if (!count) return null;
    return `Session restaurée — ${count} produit(s). Statuts d'envoi réinitialisés : vous pouvez renvoyer vers PrestaShop.`;
  });
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scrapeProgress, setScrapeProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [autoSelectImages, setAutoSelectImages] = useState(
    readAutoSelectImagesPreference,
  );

  const parsedUrls = useMemo(() => parseSourceUrls(urlsText), [urlsText]);

  useEffect(() => {
    const ok = saveQuickImportDraft({
      version: 3,
      savedAt: Date.now(),
      urlsText,
      price,
      stock,
      defaultCategoryId,
      products,
      brokenLinks,
    });
    if (ok) setDraftSavedAt(Date.now());
  }, [urlsText, price, stock, defaultCategoryId, products, brokenLinks]);

  useEffect(() => {
    void (async () => {
      setLoadingCategories(true);
      try {
        const res = await fetch("/api/admin/quick-import", {
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
          data.categoryGroups ?? buildAdminCategoryOptGroups(data.categories ?? []);
        setCategoryOptGroups(optGroups);
        const flat = flattenAdminCategoryOptGroups(optGroups);
        const configured = data.defaultCategoryId ?? "";
        const pick =
          flat.find((o) => o.id === configured)?.id ?? flat[0]?.id ?? configured;
        if (!defaultCategoryId) setDefaultCategoryId(pick);
        if (!saved?.price && typeof data.defaultPrice === "number") {
          setPrice(String(data.defaultPrice));
        }
        if (!saved?.stock && typeof data.defaultStock === "number") {
          setStock(String(data.defaultStock));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur catégories.");
      } finally {
        setLoadingCategories(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secret]);

  function updateProduct(id: string, patch: Partial<QuickProduct>) {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  async function scrapeBatch() {
    if (!parsedUrls.length) {
      setError("Collez au moins un lien produit.");
      return;
    }

    setBusy(true);
    setError(null);
    setProducts([]);
    setBrokenLinks([]);
    setScrapeProgress({ done: 0, total: parsedUrls.length });

    const flatCategories = flattenAdminCategoryOptGroups(categoryOptGroups);
    const accumulated: QuickProduct[] = [];
    const broken: BrokenLink[] = [];

    try {
      for (let i = 0; i < parsedUrls.length; i++) {
        const url = parsedUrls[i]!;
        setPhase(`Analyse des liens… ${i + 1} / ${parsedUrls.length}`);
        setScrapeProgress({ done: i, total: parsedUrls.length });

        try {
          const res = await fetch("/api/admin/quick-import", {
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
          if (!res.ok) throw new Error(data.message ?? "Scrape échoué.");

          const scraped = data.products?.[0];
          if (!scraped) {
            broken.push({ url, error: "Réponse vide du serveur." });
          } else if (scraped.error) {
            broken.push({
              url: scraped.sourceUrl || url,
              error: scraped.error,
            });
          } else {
            accumulated.push(
              mapScrapedProduct(
                scraped,
                flatCategories,
                defaultCategoryId,
                autoSelectImages,
              ),
            );
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
        setError(`${broken.length} lien(s) en échec.`);
      } else if (broken.length) {
        setError(`${accumulated.length} produit(s) OK · ${broken.length} échec(s).`);
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

  const getPushable = useCallback(
    (includeAlreadySent = false) =>
      products.filter(
        (p) =>
          p.selectedUrls.length > 0 &&
          !p.scrapeError &&
          (includeAlreadySent || !p.pushResult?.ok),
      ),
    [products],
  );

  async function pushProducts(toSend: QuickProduct[]) {
    if (!toSend.length) {
      setError("Aucun produit prêt — sélectionnez au moins une image par produit.");
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
      for (let i = 0; i < toSend.length; i++) {
        const p = toSend[i]!;
        const productIndex = products.findIndex((item) => item.id === p.id) + 1;
        setPhase(`Envoi PrestaShop ${i + 1}/${toSend.length} — produit #${productIndex}…`);

        const res = await fetch("/api/admin/quick-import", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${secret}`,
          },
          body: JSON.stringify({
            action: "push",
            price: numericPrice,
            stock: numericStock,
            item: {
              clientId: p.id,
              name: p.name.trim(),
              categoryId: asTrimmedString(p.categoryId) || defaultCategoryId,
              sourceUrl: p.sourceUrl,
              imageUrls: p.selectedUrls,
            },
          }),
        });

        const data = (await res.json()) as {
          ok?: boolean;
          message?: string;
          result?: {
            ok: boolean;
            productId?: string;
            error?: string;
          };
        };

        if (!res.ok && !data.result) {
          updateProduct(p.id, {
            pushResult: {
              ok: false,
              error: data.message ?? `Erreur serveur (${res.status}).`,
            },
          });
          failCount++;
          continue;
        }

        const result = data.result;
        updateProduct(p.id, {
          pushResult: {
            ok: result?.ok ?? false,
            productId: result?.productId,
            error: result?.error ?? data.message,
          },
        });

        if (result?.ok) okCount++;
        else failCount++;
      }

      if (failCount > 0) {
        setError(`${okCount} envoyé(s) · ${failCount} échec(s).`);
      }
      setPhase(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Envoi échoué.");
      setPhase(null);
    } finally {
      setBusy(false);
    }
  }

  async function pushPending() {
    await pushProducts(getPushable(false));
  }

  async function pushAll() {
    const all = getPushable(true);
    if (!all.length) {
      setError("Aucun produit à envoyer.");
      return;
    }
    const alreadySent = all.filter((p) => p.pushResult?.ok).length;
    const message =
      alreadySent > 0
        ? `${all.length} produit(s) seront envoyés (images brutes, sans rendu).\n\n${alreadySent} déjà marqués envoyés — doublons possibles sur PrestaShop.\n\nContinuer ?`
        : `${all.length} produit(s) seront envoyés avec les images scrappées (qualité d'origine).\n\nContinuer ?`;
    if (!window.confirm(message)) return;
    setProducts((prev) =>
      prev.map((p) =>
        all.some((item) => item.id === p.id) ? { ...p, pushResult: null } : p,
      ),
    );
    await pushProducts(all);
  }

  function resetPushStatus() {
    setProducts((prev) => prev.map((p) => ({ ...p, pushResult: null })));
  }

  function clearAllSelections() {
    setProducts((prev) =>
      prev.map((p) => (p.selectedUrls.length ? { ...p, selectedUrls: [] } : p)),
    );
  }

  const readyToPush = getPushable(false).length;
  const pushableTotal = getPushable(true).length;
  const selectedImages = products.reduce((n, p) => n + p.selectedUrls.length, 0);
  const pushFailures = useMemo(
    () =>
      products
        .map((p, index) => ({ p, index }))
        .filter(({ p }) => p.pushResult && !p.pushResult.ok)
        .map(({ p, index }) => ({
          id: p.id,
          index: index + 1,
          name: p.name,
          error: p.pushResult?.error,
        })),
    [products],
  );

  async function retryFailedPushes() {
    const failed = getPushable(false).filter((p) => p.pushResult && !p.pushResult.ok);
    await pushProducts(failed);
  }

  return (
    <section className="relative mt-16 rounded-3xl border border-[#1a7f37]/30 bg-[#1a7f37]/[0.04] p-6 lg:p-8">
      <h2 className="font-display text-xl font-semibold">Import rapide PrestaShop</h2>
      <p className="mt-1 text-sm text-ink/55">
        Scrape → images brutes (sans détourage ni rendu) → envoi PrestaShop. Même
        noms et catégories que le studio, en beaucoup plus rapide.
      </p>
      {restoreNotice ? (
        <p className="mt-3 rounded-xl border border-[#1a7f37]/20 bg-white/80 px-3 py-2 text-xs text-ink/65">
          {restoreNotice}
        </p>
      ) : null}
      {draftSavedAt ? (
        <p className="mt-2 text-[11px] text-ink/40">
          Progression sauvegardée automatiquement dans le navigateur (persiste après fermeture).
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field
          label="Prix (€)"
          name="quickPrice"
          type="number"
          min="0"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        <Field
          label="Stock par taille"
          name="quickStock"
          type="number"
          min="0"
          step="1"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
        />
      </div>

      <div className="mt-4">
        <label className="mb-1 block text-xs font-medium text-ink/60">
          Catégorie par défaut
        </label>
        <AdminCategoryPicker
          optGroups={categoryOptGroups}
          value={defaultCategoryId}
          disabled={loadingCategories}
          onChange={setDefaultCategoryId}
        />
      </div>

      <TextareaField
        className="mt-4"
        label="Liens produits (un par ligne)"
        name="quickUrls"
        rows={6}
        value={urlsText}
        onChange={(e) => setUrlsText(e.target.value)}
        placeholder="https://…"
      />
      <p className="mt-1 text-xs text-ink/45">
        {parsedUrls.length} lien(s) détecté(s)
      </p>

      <ImportLinkAlerts parsedUrls={parsedUrls} brokenLinks={brokenLinks} />

      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-ink/10 bg-paper-soft px-4 py-3">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={autoSelectImages}
          onChange={(e) => {
            const next = e.target.checked;
            setAutoSelectImages(next);
            writeAutoSelectImagesPreference(next);
          }}
        />
        <span className="text-sm text-ink/75">
          <strong className="font-medium text-ink">Sélection auto des images</strong>
          <span className="mt-0.5 block text-xs text-ink/50">
            Face + dos (classique) ou 6 vues pour eSport — avant le scrape.
          </span>
        </span>
      </label>

      <div className="mt-4 flex flex-wrap gap-3">
        <Button type="button" onClick={() => void scrapeBatch()} disabled={busy}>
          {busy && phase?.startsWith("Analyse") ? (
            <Spinner className="h-4 w-4" />
          ) : (
            `1. Scraper (${parsedUrls.length || 0})`
          )}
        </Button>
        <Button
          type="button"
          className="bg-[#1a7f37] hover:bg-[#156b2e]"
          onClick={() => void pushPending()}
          disabled={busy || readyToPush === 0}
        >
          {busy && phase?.startsWith("Envoi") ? (
            <Spinner className="h-4 w-4" />
          ) : (
            `2. Envoyer les restants (${readyToPush})`
          )}
        </Button>
        {pushableTotal > 0 ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => void pushAll()}
            disabled={busy}
          >
            Envoyer tout ({pushableTotal})
          </Button>
        ) : null}
        {products.some((p) => p.pushResult) ? (
          <Button type="button" variant="outline" onClick={resetPushStatus} disabled={busy}>
            Réinitialiser statuts
          </Button>
        ) : null}
        {selectedImages > 0 ? (
          <Button
            type="button"
            variant="outline"
            onClick={clearAllSelections}
            disabled={busy}
          >
            Tout désélectionner
          </Button>
        ) : null}
      </div>

      {phase ? <p className="mt-3 text-sm text-ink/60">{phase}</p> : null}
      {products.length > 0 ? (
        <p className="mt-3 text-xs text-ink/50">
          {products.length} produit(s) · {selectedImages} image(s) sélectionnée(s) ·{" "}
          {readyToPush} en attente d&apos;envoi
          {pushFailures.length > 0 ? ` · ${pushFailures.length} échec(s) d'envoi` : ""}
        </p>
      ) : null}
      {scrapeProgress ? (
        <p className="mt-2 text-xs text-ink/45">
          {scrapeProgress.done} / {scrapeProgress.total} lien(s)
        </p>
      ) : null}
      {error ? <p className="mt-3 text-sm text-accent">{error}</p> : null}

      <PushFailuresAlert
        failures={pushFailures}
        busy={busy}
        onRetry={() => void retryFailedPushes()}
        scrollTargetId={(id) => `quick-product-${id}`}
      />

      {products.length > 0 ? (
        <div className="mt-8 space-y-6">
          {products.map((product, index) => (
            <article
              key={product.id}
              id={`quick-product-${product.id}`}
              className={cn(
                "scroll-mt-24 rounded-2xl border bg-white/70 p-4",
                product.pushResult && !product.pushResult.ok
                  ? "border-accent ring-2 ring-accent/25"
                  : "border-ink/8",
              )}
            >
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1a7f37] text-xs font-bold text-white">
                  {index + 1}
                </span>
                <input
                  type="text"
                  value={product.name}
                  onChange={(e) => updateProduct(product.id, { name: e.target.value })}
                  className="min-w-0 flex-1 rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm font-medium"
                />
              </div>
              <a
                href={product.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block truncate text-xs text-accent underline-offset-2 hover:underline"
              >
                {product.sourceUrl}
              </a>

              <div className="mt-3 sm:max-w-md">
                <label className="mb-1 block text-xs font-medium text-ink/60">
                  Catégorie PrestaShop
                </label>
                <AdminCategoryPicker
                  optGroups={categoryOptGroups}
                  value={product.categoryId || defaultCategoryId}
                  disabled={loadingCategories}
                  compact
                  onChange={(categoryId) => updateProduct(product.id, { categoryId })}
                />
              </div>

              <p className="mt-3 text-xs text-ink/50">
                Images — cliquez pour sélectionner (#1 = couverture). Envoyées en qualité
                d&apos;origine.
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
                {product.imageUrls.map((url) => {
                  const order = imageOrder(product, url);
                  const selected = order > 0;
                  const key = url.startsWith("data:") ? `${url.slice(0, 48)}-${order}` : url;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() =>
                        updateProduct(product.id, toggleImageUrl(product, url))
                      }
                      className={cn(
                        "relative aspect-[4/5] overflow-hidden rounded-lg border-2 bg-white",
                        selected
                          ? "border-[#1a7f37] ring-2 ring-[#1a7f37]/25"
                          : "border-transparent opacity-75 hover:opacity-100",
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt=""
                        className="h-full w-full object-contain p-1"
                        loading="lazy"
                      />
                      {selected ? (
                        <span className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#1a7f37] text-[10px] font-bold text-white">
                          {order}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4">
                <label className="text-xs font-medium text-ink/50">
                  Ajouter des images (glisser-déposer, coller ou fichier)
                </label>
                <div
                  tabIndex={0}
                  className="mt-2 rounded-xl border border-dashed border-ink/15 bg-white/60 px-4 py-5 text-center outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/20"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void importPastedImages(
                      product,
                      Array.from(e.dataTransfer.files),
                      updateProduct,
                    ).catch((err) =>
                      setError(err instanceof Error ? err.message : "Import image échoué."),
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
                    void importPastedImages(product, files, updateProduct).catch((err) =>
                      setError(err instanceof Error ? err.message : "Import image échoué."),
                    );
                  }}
                >
                  <p className="text-xs text-ink/55">
                    Cliquez ici puis <kbd className="rounded bg-ink/5 px-1">Ctrl+V</kbd> pour
                    coller, ou déposez des fichiers.
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
                      void importPastedImages(product, files, updateProduct).catch((err) =>
                        setError(err instanceof Error ? err.message : "Import image échoué."),
                      );
                    }}
                  />
                </div>
              </div>

              {product.pushResult ? (
                <p
                  className={cn(
                    "mt-3 text-xs font-medium",
                    product.pushResult.ok ? "text-[#1a7f37]" : "text-accent",
                  )}
                >
                  {product.pushResult.ok
                    ? `Envoyé ✓ (#${product.pushResult.productId})`
                    : `Échec : ${product.pushResult.error}`}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

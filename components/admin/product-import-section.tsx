"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, TextareaField } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { productImportConfig } from "@/config/product-import";
import { parseSourceUrls } from "@/lib/product-import/parse-urls";
import { pickImportDefaultCategoryId } from "@/lib/product-import/pick-default-category";
import { cn } from "@/lib/utils";

type BulkResult = {
  sourceUrl: string;
  ok: boolean;
  productId?: string;
  name?: string;
  imagesUploaded?: number;
  error?: string;
};

type CategoryOption = { id: string; name: string };

type CategoryMode = "existing" | "new";

async function readImageFile(
  file: File,
): Promise<{ base64: string; mime: string } | null> {
  if (!file.type.startsWith("image/")) return null;
  if (file.size > 3 * 1024 * 1024) {
    throw new Error("Image trop volumineuse (max 3 Mo).");
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Lecture de l'image impossible."));
        return;
      }
      const base64 = result.split(",")[1];
      if (!base64) {
        reject(new Error("Lecture de l'image impossible."));
        return;
      }
      resolve({ base64, mime: file.type });
    };
    reader.onerror = () => reject(new Error("Lecture de l'image impossible."));
    reader.readAsDataURL(file);
  });
}

export function ProductImportSection({ secret }: { secret: string }) {
  const [urlsText, setUrlsText] = useState("");
  const [price, setPrice] = useState(String(productImportConfig.defaultPrice));
  const [categoryMode, setCategoryMode] = useState<CategoryMode>("existing");
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryImageFile, setCategoryImageFile] = useState<File | null>(null);
  const [categoryImagePreview, setCategoryImagePreview] = useState<string | null>(
    null,
  );
  const [results, setResults] = useState<BulkResult[] | null>(null);
  const [categoryResult, setCategoryResult] = useState<{
    id: string;
    name: string;
    created: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    url: string;
  } | null>(null);

  const parsedUrls = useMemo(() => parseSourceUrls(urlsText), [urlsText]);
  const urlCount = parsedUrls.length;
  const overLimit = urlCount > productImportConfig.maxUrlsPerImport;

  useEffect(() => {
    void (async () => {
      setLoadingCategories(true);
      try {
        const res = await fetch("/api/admin/product-import", {
          headers: { Authorization: `Bearer ${secret}` },
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          categories?: CategoryOption[];
          defaultCategoryId?: string;
        };
        const list = data.categories ?? [];
        setCategories(list);
        const defaultId = pickImportDefaultCategoryId(
          list,
          data.defaultCategoryId || productImportConfig.defaultCategoryId,
        );
        setCategoryId(defaultId);
      } finally {
        setLoadingCategories(false);
      }
    })();
  }, [secret]);

  useEffect(() => {
    if (!categoryImageFile) {
      setCategoryImagePreview(null);
      return;
    }
    const url = URL.createObjectURL(categoryImageFile);
    setCategoryImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [categoryImageFile]);

  async function importAll() {
    const urls = parseSourceUrls(urlsText);
    if (urls.length === 0) {
      setError("Aucun lien valide détecté.");
      return;
    }
    if (urls.length > productImportConfig.maxUrlsPerImport) {
      setError(
        `Maximum ${productImportConfig.maxUrlsPerImport} liens par import.`,
      );
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);
    setCategoryResult(null);
    setProgress(null);

    try {
      let newCategoryImageBase64: string | undefined;
      let newCategoryImageMime: string | undefined;

      if (categoryMode === "new") {
        if (!newCategoryName.trim()) {
          throw new Error("Indiquez un nom pour la nouvelle catégorie.");
        }
        if (!categoryImageFile) {
          throw new Error("Ajoutez une image pour la nouvelle catégorie.");
        }
        const image = await readImageFile(categoryImageFile);
        if (!image) throw new Error("Format d'image non supporté.");
        newCategoryImageBase64 = image.base64;
        newCategoryImageMime = image.mime;
      } else if (!categoryId) {
        throw new Error("Sélectionnez une catégorie existante.");
      }

      const categoryPayload = {
        categoryMode,
        categoryId: categoryMode === "existing" ? categoryId : undefined,
        newCategoryName:
          categoryMode === "new" ? newCategoryName.trim() : undefined,
        newCategoryImageBase64,
        newCategoryImageMime,
      };

      const catRes = await fetch("/api/admin/product-import", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "resolve_category", ...categoryPayload }),
      });
      const catData = (await catRes.json()) as {
        ok?: boolean;
        message?: string;
        category?: { id: string; name: string; created: boolean };
      };
      if (!catRes.ok || !catData.category) {
        throw new Error(catData.message ?? "Impossible de préparer la catégorie.");
      }

      const resolvedCategory = catData.category;
      setCategoryResult(resolvedCategory);

      const allResults: BulkResult[] = [];
      const importPrice = Number.parseFloat(price) || undefined;

      for (let i = 0; i < urls.length; i++) {
        const sourceUrl = urls[i]!;
        setProgress({ current: i + 1, total: urls.length, url: sourceUrl });

        try {
          const res = await fetch("/api/admin/product-import", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${secret}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              action: "import",
              url: sourceUrl,
              categoryId: resolvedCategory.id,
              price: importPrice,
            }),
          });

          const data = (await res.json()) as {
            ok?: boolean;
            message?: string;
            result?: {
              productId: string;
              name: string;
              imagesUploaded: number;
            };
          };

          if (!res.ok || !data.result) {
            allResults.push({
              sourceUrl,
              ok: false,
              error: data.message ?? "Import échoué.",
            });
          } else {
            allResults.push({
              sourceUrl,
              ok: true,
              productId: data.result.productId,
              name: data.result.name,
              imagesUploaded: data.result.imagesUploaded,
            });
          }
        } catch {
          allResults.push({
            sourceUrl,
            ok: false,
            error: "Erreur réseau lors de l'import.",
          });
        }
      }

      setResults(allResults);
      setProgress(null);

      const okCount = allResults.filter((r) => r.ok).length;
      if (okCount > 0) {
        setUrlsText("");
        if (categoryMode === "new" && resolvedCategory.created) {
          setNewCategoryName("");
          setCategoryImageFile(null);
          setCategoryMode("existing");
          setCategoryId(resolvedCategory.id);
          const refresh = await fetch("/api/admin/product-import", {
            headers: { Authorization: `Bearer ${secret}` },
          });
          if (refresh.ok) {
            const refreshed = (await refresh.json()) as {
              categories?: CategoryOption[];
            };
            setCategories(refreshed.categories ?? []);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue.");
      setProgress(null);
    } finally {
      setLoading(false);
    }
  }

  const okCount = results?.filter((r) => r.ok).length ?? 0;

  return (
    <section className="mt-16 rounded-2xl border border-ink/10 bg-paper-soft/50 p-6">
      <h2 className="text-lg font-semibold text-ink">Import produit depuis URL</h2>
      <p className="mt-2 text-sm text-ink/55">
        Collez une ou plusieurs URLs (une par ligne). Choisissez une catégorie
        existante ou créez-en une nouvelle avec nom et image.
      </p>

      <div className="mt-6 space-y-4">
        <TextareaField
          label="URLs des produits"
          name="import-urls"
          rows={8}
          placeholder={
            "https://exemple.com/maillot-1\nhttps://exemple.com/maillot-2\n..."
          }
          value={urlsText}
          onChange={(e) => setUrlsText(e.target.value)}
        />

        {urlCount > 0 ? (
          <div className="rounded-lg bg-paper-soft/80 px-3 py-2 text-xs text-ink/50">
            <p>
              {urlCount} produit{urlCount > 1 ? "s" : ""} détecté
              {urlCount > 1 ? "s" : ""} — chaque lien sera importé
              individuellement.
            </p>
            {overLimit ? (
              <p className="mt-1 text-red-600">
                Maximum {productImportConfig.maxUrlsPerImport} liens par import.
              </p>
            ) : null}
            {urlCount <= 8 ? (
              <ol className="mt-2 list-decimal space-y-0.5 pl-4 text-ink/45">
                {parsedUrls.map((u) => (
                  <li key={u} className="truncate">
                    {u}
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
        ) : null}

        <Field
          label="Prix par défaut (€)"
          name="import-price"
          type="number"
          min="0"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />

        <div className="rounded-xl border border-ink/8 bg-paper p-4">
          <p className="text-xs font-medium text-ink/60">Catégorie de destination</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(
              [
                ["existing", "Catégorie existante"],
                ["new", "Nouvelle catégorie"],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setCategoryMode(mode)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm transition-colors",
                  categoryMode === mode
                    ? "border-ink bg-ink text-paper"
                    : "border-ink/15 text-ink/70 hover:border-ink/30",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {categoryMode === "existing" ? (
            <div className="mt-4">
              {loadingCategories ? (
                <p className="text-sm text-ink/45">Chargement des catégories…</p>
              ) : (
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-ink/60">
                    Choisir une catégorie
                  </span>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="h-12 w-full rounded-xl border border-ink/15 bg-paper px-4 text-sm outline-none focus:border-ink"
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <Field
                label="Nom de la nouvelle catégorie"
                name="new-category-name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Ex. Collection PSG 2025"
              />
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-ink/60">
                  Image de la catégorie
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) =>
                    setCategoryImageFile(e.target.files?.[0] ?? null)
                  }
                  className="text-sm text-ink/70 file:mr-3 file:rounded-lg file:border-0 file:bg-ink file:px-3 file:py-2 file:text-sm file:text-paper"
                />
              </label>
              {categoryImagePreview ? (
                <img
                  src={categoryImagePreview}
                  alt="Aperçu catégorie"
                  className="h-24 w-24 rounded-xl border border-ink/10 object-cover"
                />
              ) : null}
            </div>
          )}
        </div>

        <Button
          type="button"
          disabled={loading || urlCount === 0 || overLimit}
          onClick={() => void importAll()}
        >
          {loading ? <Spinner className="mr-2 h-4 w-4" /> : null}
          {loading && progress
            ? `Import ${progress.current}/${progress.total}…`
            : `Importer ${urlCount > 0 ? urlCount : ""} produit${urlCount > 1 ? "s" : ""}`}
        </Button>

        {progress ? (
          <p className="truncate text-xs text-ink/45">
            En cours : {progress.url}
          </p>
        ) : null}

        {error ? (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        {categoryResult ? (
          <p className="rounded-xl bg-blue-50/80 px-4 py-3 text-sm text-blue-900">
            {categoryResult.created ? "Catégorie créée" : "Catégorie utilisée"} :{" "}
            <strong>{categoryResult.name}</strong> (ID {categoryResult.id})
          </p>
        ) : null}

        {results ? (
          <div className="rounded-xl border border-ink/8 bg-paper p-4">
            <p className="text-sm font-medium text-ink">
              {okCount}/{results.length} produit{results.length > 1 ? "s" : ""}{" "}
              importé{okCount > 1 ? "s" : ""}
            </p>
            <ul className="mt-4 max-h-80 space-y-2 overflow-y-auto text-sm">
              {results.map((item) => (
                <li
                  key={item.sourceUrl}
                  className={
                    item.ok
                      ? "rounded-lg bg-emerald-50/80 px-3 py-2 text-emerald-900"
                      : "rounded-lg bg-red-50/80 px-3 py-2 text-red-800"
                  }
                >
                  <p className="truncate font-medium">
                    {item.ok ? item.name : "Échec"}
                  </p>
                  <p className="truncate text-xs opacity-70">{item.sourceUrl}</p>
                  {item.ok ? (
                    <p className="mt-0.5 text-xs opacity-80">
                      ID {item.productId} · {item.imagesUploaded ?? 0} image(s)
                    </p>
                  ) : (
                    <p className="mt-0.5 text-xs">{item.error}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}

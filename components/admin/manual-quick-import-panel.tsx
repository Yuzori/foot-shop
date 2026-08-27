"use client";

import { useEffect, useRef, useState } from "react";

import { AdminCategoryPicker } from "@/components/admin/admin-category-picker";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import type { AdminCategoryOptGroup } from "@/lib/admin/import-category-tree";
import { cn } from "@/lib/utils";

export type ManualQuickImportDraft = {
  name: string;
  categoryId: string;
  imageUrls: string[];
  sourceUrl?: string;
};

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

export function ManualQuickImportPanel({
  defaultCategoryId,
  categoryOptGroups,
  loadingCategories,
  busy,
  onAdd,
}: {
  defaultCategoryId: string;
  categoryOptGroups: AdminCategoryOptGroup[];
  loadingCategories: boolean;
  busy: boolean;
  onAdd: (draft: ManualQuickImportDraft, sendNow: boolean) => void | Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [categoryId, setCategoryId] = useState(defaultCategoryId);
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (defaultCategoryId && !categoryId) setCategoryId(defaultCategoryId);
  }, [categoryId, defaultCategoryId]);

  async function ingestFiles(files: File[]) {
    const imageFiles = files.filter((f) => f.type.startsWith("image/"));
    if (!imageFiles.length) {
      setError("Aucune image valide (JPEG, PNG, WebP…).");
      return;
    }

    const added: string[] = [];
    for (const file of imageFiles) {
      added.push(await readImageFile(file));
    }

    setImages((prev) => [...prev, ...added]);
    setError(null);
  }

  function validate(): ManualQuickImportDraft | null {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Indiquez un nom de produit.");
      return null;
    }
    if (!images.length) {
      setError("Ajoutez au moins une image.");
      return null;
    }
    const cat = categoryId || defaultCategoryId;
    if (!cat) {
      setError("Choisissez une catégorie PrestaShop.");
      return null;
    }
    return {
      name: trimmedName,
      categoryId: cat,
      imageUrls: images,
      sourceUrl: sourceUrl.trim() || undefined,
    };
  }

  async function submit(sendNow: boolean) {
    const draft = validate();
    if (!draft) return;
    await onAdd(draft, sendNow);
    setName("");
    setSourceUrl("");
    setImages([]);
    setCategoryId(defaultCategoryId);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeImage(url: string) {
    setImages((prev) => prev.filter((item) => item !== url));
  }

  return (
    <div className="mt-6 rounded-2xl border border-violet-500/35 bg-violet-500/[0.06] p-4 sm:p-5">
      <div>
        <h3 className="text-sm font-semibold text-ink">Import manuel</h3>
        <p className="mt-1 text-xs text-ink/55">
          Sans scrape : vous ajoutez les images, le nom et la catégorie. Prix (
          <strong>25,99 €</strong>) et stock (<strong>20</strong> par taille S→XXL) =
          champs ci-dessus, puis envoi PrestaShop.
        </p>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field
          label="Nom du produit"
          name="manualName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Maillot Domicile Paris SG 2025/26"
        />
        <Field
          label="Lien source (optionnel)"
          name="manualSourceUrl"
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          placeholder="https://…"
        />
      </div>

      <div className="mt-4 sm:max-w-md">
        <label className="mb-1 block text-xs font-medium text-ink/60">Catégorie</label>
        <AdminCategoryPicker
          optGroups={categoryOptGroups}
          value={categoryId || defaultCategoryId}
          disabled={loadingCategories}
          onChange={setCategoryId}
        />
      </div>

      <div className="mt-4">
        <label className="text-xs font-medium text-ink/60">Images produit</label>
        <div
          tabIndex={0}
          className="mt-2 rounded-xl border border-dashed border-violet-500/30 bg-white/70 px-4 py-6 text-center outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20"
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void ingestFiles(Array.from(e.dataTransfer.files)).catch((err) =>
              setError(err instanceof Error ? err.message : "Import image échoué."),
            );
          }}
          onPaste={(e) => {
            const files: File[] = [];
            for (const item of e.clipboardData?.items ?? []) {
              if (item.kind === "file") {
                const file = item.getAsFile();
                if (file) files.push(file);
              }
            }
            if (!files.length) return;
            e.preventDefault();
            void ingestFiles(files).catch((err) =>
              setError(err instanceof Error ? err.message : "Import image échoué."),
            );
          }}
        >
          <p className="text-xs text-ink/55">
            Glissez-déposez, collez (Ctrl+V) ou choisissez des fichiers
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-3"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
          >
            Choisir des images
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (!files.length) return;
              void ingestFiles(files).catch((err) =>
                setError(err instanceof Error ? err.message : "Import image échoué."),
              );
            }}
          />
        </div>

        {images.length > 0 ? (
          <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
            {images.map((url, index) => (
              <div
                key={`${url.slice(0, 32)}-${index}`}
                className="relative aspect-[4/5] overflow-hidden rounded-lg border border-ink/10 bg-white"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-contain p-1" />
                <button
                  type="button"
                  className="absolute right-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-black/80"
                  onClick={() => removeImage(url)}
                >
                  ×
                </button>
                <span className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white">
                  {index + 1}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={busy}
          onClick={() => void submit(false)}
        >
          Ajouter à la liste
        </Button>
        <Button
          type="button"
          className="bg-[#1a7f37] hover:bg-[#156b2e]"
          disabled={busy}
          onClick={() => void submit(true)}
        >
          Ajouter et envoyer
        </Button>
      </div>

      {error ? <p className={cn("mt-3 text-xs text-accent")}>{error}</p> : null}
    </div>
  );
}

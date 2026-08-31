const DB_NAME = "maillot-store-quick-import";
const DB_VERSION = 1;
const STORE = "images";

type ImageRecord = {
  id: string;
  dataUrl: string;
  savedAt: number;
};

export const QUICK_IMPORT_IMAGE_REF_PREFIX = "idb:";

export function isQuickImportImageRef(value: string): boolean {
  return value.startsWith(QUICK_IMPORT_IMAGE_REF_PREFIX);
}

export function quickImportImageRef(id: string): string {
  return `${QUICK_IMPORT_IMAGE_REF_PREFIX}${id}`;
}

export function quickImportImageIdFromRef(ref: string): string | null {
  if (!isQuickImportImageRef(ref)) return null;
  const id = ref.slice(QUICK_IMPORT_IMAGE_REF_PREFIX.length).trim();
  return id || null;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB indisponible."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
  });
}

export async function putQuickImportImage(id: string, dataUrl: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const record: ImageRecord = { id, dataUrl, savedAt: Date.now() };
    tx.objectStore(STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB write failed"));
  });
  db.close();
}

export async function getQuickImportImage(id: string): Promise<string | null> {
  const db = await openDb();
  const record = await new Promise<ImageRecord | null>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).get(id);
    request.onsuccess = () => resolve((request.result as ImageRecord | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB read failed"));
  });
  db.close();
  return record?.dataUrl ?? null;
}

export async function deleteQuickImportImage(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB delete failed"));
  });
  db.close();
}

export async function pruneQuickImportImages(keepIds: string[]): Promise<void> {
  const keep = new Set(keepIds);
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const request = store.getAllKeys();
    request.onsuccess = () => {
      for (const key of request.result) {
        if (!keep.has(String(key))) store.delete(key);
      }
    };
    request.onerror = () => reject(request.error ?? new Error("IndexedDB prune failed"));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB prune failed"));
  });
  db.close();
}

export async function resolveQuickImportImageUrl(refOrUrl: string): Promise<string> {
  const id = quickImportImageIdFromRef(refOrUrl);
  if (!id) return refOrUrl;
  const stored = await getQuickImportImage(id);
  if (!stored) throw new Error("Image locale introuvable — réimportez-la.");
  return stored;
}

export async function persistQuickImportImageUrls(
  productId: string,
  dataUrls: string[],
): Promise<string[]> {
  const refs: string[] = [];
  for (let index = 0; index < dataUrls.length; index++) {
    const dataUrl = dataUrls[index]!;
    const id = `${productId}-${index}`;
    await putQuickImportImage(id, dataUrl);
    refs.push(quickImportImageRef(id));
  }
  return refs;
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const match = dataUrl.match(/^data:([^;,]+)?(?:;base64)?,(.*)$/s);
  if (!match?.[2]) {
    throw new Error("Image locale invalide.");
  }

  const mimeType = (match[1] || "image/jpeg").trim();
  const base64 = match[2].replace(/\s/g, "");
  const bytes = base64ToUint8Array(base64);
  return new Blob([bytes as BlobPart], { type: mimeType });
}

function base64ToUint8Array(base64: string): Uint8Array {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  const byteLength = Math.floor((base64.length * 3) / 4) - padding;
  const bytes = new Uint8Array(byteLength);

  const chunkChars = 4 * 16_384;
  let byteOffset = 0;

  for (let index = 0; index < base64.length; index += chunkChars) {
    const slice = base64.slice(index, index + chunkChars);
    const binary = atob(slice);
    for (let charIndex = 0; charIndex < binary.length; charIndex++) {
      bytes[byteOffset++] = binary.charCodeAt(charIndex);
    }
  }

  return bytes;
}

export async function compressImageBlob(
  blob: Blob,
  maxDimension = 2200,
  quality = 0.88,
): Promise<Blob> {
  if (typeof document === "undefined") return blob;
  if (!blob.type.startsWith("image/")) return blob;

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    return blob;
  }

  try {
    const largest = Math.max(bitmap.width, bitmap.height);
    const scale = largest > maxDimension ? maxDimension / largest : 1;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return blob;
    context.drawImage(bitmap, 0, 0, width, height);

    const compressed = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((value) => resolve(value), "image/jpeg", quality);
    });
    if (!compressed || compressed.size >= blob.size) return blob;
    return compressed;
  } catch {
    return blob;
  } finally {
    bitmap.close();
  }
}

export async function stageQuickImportImageBlobs(
  blobs: Blob[],
  authorization: string,
): Promise<string[]> {
  const stagedIds: string[] = [];

  for (let index = 0; index < blobs.length; index++) {
    const compressed = await compressImageBlob(blobs[index]!);
    const form = new FormData();
    form.append("file", compressed, `image-${index}.jpg`);

    let res: Response;
    try {
      res = await fetch("/api/admin/quick-import/stage-image", {
        method: "POST",
        headers: { Authorization: authorization },
        body: form,
      });
    } catch {
      throw new Error(
        `Envoi image ${index + 1}/${blobs.length} impossible (réseau).`,
      );
    }

    let data: { imageId?: string; message?: string };
    try {
      data = (await res.json()) as typeof data;
    } catch {
      throw new Error(
        `Réponse serveur invalide pour l'image ${index + 1} (${res.status}).`,
      );
    }

    if (!res.ok || !data.imageId) {
      throw new Error(
        data.message ??
          `Échec envoi image ${index + 1}/${blobs.length} (${res.status}).`,
      );
    }

    stagedIds.push(data.imageId);
  }

  return stagedIds;
}

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
  const response = await fetch(dataUrl);
  return response.blob();
}

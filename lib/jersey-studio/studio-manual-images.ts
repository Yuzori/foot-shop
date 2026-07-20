const DB_NAME = "maillot-store-jersey-studio";
const DB_VERSION = 2;
const STORE = "manual-images";
const RENDER_STORE = "render-previews";

type ManualImageRecord = {
  id: string;
  base64: string;
  preview: string;
  savedAt: number;
};

type RenderPreviewRecord = {
  id: string;
  preview: string;
  savedAt: number;
};

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
      if (!db.objectStoreNames.contains(RENDER_STORE)) {
        db.createObjectStore(RENDER_STORE, { keyPath: "id" });
      }
    };
  });
}

export async function putManualImage(
  id: string,
  base64: string,
  preview: string,
): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const record: ManualImageRecord = {
      id,
      base64,
      preview,
      savedAt: Date.now(),
    };
    store.put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB write failed"));
  });
  db.close();
}

export async function getManualImage(
  id: string,
): Promise<{ base64: string; preview: string } | null> {
  const db = await openDb();
  const record = await new Promise<ManualImageRecord | null>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).get(id);
    request.onsuccess = () => resolve((request.result as ManualImageRecord | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB read failed"));
  });
  db.close();
  if (!record) return null;
  return { base64: record.base64, preview: record.preview };
}

export async function deleteManualImage(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB delete failed"));
  });
  db.close();
}

export async function pruneManualImages(keepIds: string[]): Promise<void> {
  const keep = new Set(keepIds);
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const request = store.getAllKeys();
    request.onsuccess = () => {
      for (const key of request.result) {
        if (!keep.has(String(key))) {
          store.delete(key);
        }
      }
    };
    request.onerror = () => reject(request.error ?? new Error("IndexedDB prune failed"));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB prune failed"));
  });
  db.close();
}

export async function hydrateManualSelections<
  T extends { id: string; kind: "scraped" | "manual"; manualBase64?: string; manualPreview?: string },
>(selections: T[]): Promise<T[]> {
  return Promise.all(
    selections.map(async (selection) => {
      if (selection.kind !== "manual") return selection;
      if (selection.manualBase64 && selection.manualPreview) return selection;
      const stored = await getManualImage(selection.id);
      if (!stored) return selection;
      return {
        ...selection,
        manualBase64: stored.base64,
        manualPreview: stored.preview,
      };
    }),
  );
}

export async function putRenderPreview(id: string, preview: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(RENDER_STORE, "readwrite");
    const record: RenderPreviewRecord = { id, preview, savedAt: Date.now() };
    tx.objectStore(RENDER_STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB render write failed"));
  });
  db.close();
}

export async function getRenderPreview(id: string): Promise<string | null> {
  const db = await openDb();
  const record = await new Promise<RenderPreviewRecord | null>((resolve, reject) => {
    const tx = db.transaction(RENDER_STORE, "readonly");
    const request = tx.objectStore(RENDER_STORE).get(id);
    request.onsuccess = () =>
      resolve((request.result as RenderPreviewRecord | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB render read failed"));
  });
  db.close();
  return record?.preview ?? null;
}

export async function deleteRenderPreview(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(RENDER_STORE, "readwrite");
    tx.objectStore(RENDER_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB render delete failed"));
  });
  db.close();
}

export async function pruneRenderPreviews(keepIds: string[]): Promise<void> {
  const keep = new Set(keepIds);
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(RENDER_STORE, "readwrite");
    const store = tx.objectStore(RENDER_STORE);
    const request = store.getAllKeys();
    request.onsuccess = () => {
      for (const key of request.result) {
        if (!keep.has(String(key))) {
          store.delete(key);
        }
      }
    };
    request.onerror = () => reject(request.error ?? new Error("IndexedDB render prune failed"));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB render prune failed"));
  });
  db.close();
}

export async function hydrateRenderSelections<
  T extends { id: string; renderPreview?: string | null; renderError?: string | null },
>(selections: T[]): Promise<T[]> {
  return Promise.all(
    selections.map(async (selection) => {
      const stored = selection.renderPreview
        ? selection.renderPreview
        : await getRenderPreview(selection.id);
      if (!stored) return { ...selection, renderError: null };
      return { ...selection, renderPreview: stored, renderError: null };
    }),
  );
}

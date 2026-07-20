const STORAGE_KEY = "bbdbuy-auto-image-select";

/** Préférence admin : sélection auto des images au scrape (activée par défaut). */
export function readAutoSelectImagesPreference(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
}

export function writeAutoSelectImagesPreference(enabled: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
}

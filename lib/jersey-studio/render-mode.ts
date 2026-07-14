import { detectRenderModeFromRgba } from "@/lib/jersey-studio/detect-render-mode";

export type JerseyRenderMode = "uniform" | "detail";

export function guessRenderModeFromUrl(url: string): JerseyRenderMode {
  const lower = url.toLowerCase();
  if (
    /detail|zoom|macro|close|part|texture|fabric|badge|logo|sponsor|col|manche|sleeve|collar|cou/i.test(
      lower,
    )
  ) {
    return "detail";
  }
  return "uniform";
}

/** Détection côté navigateur à partir d'une data URL ou blob URL. */
export async function guessRenderModeFromDataUrl(
  dataUrl: string,
): Promise<JerseyRenderMode> {
  if (typeof window === "undefined") return "uniform";

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve(guessRenderModeFromImageElement(img));
    };
    img.onerror = () => resolve("uniform");
    img.src = dataUrl;
  });
}

export function guessRenderModeFromImageElement(
  img: HTMLImageElement,
): JerseyRenderMode {
  const maxDim = 420;
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight, 1));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "uniform";

  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  return detectRenderModeFromRgba(data, w, h, 4);
}

const NORM_CARD_W = 328;
const NORM_CARD_H = 411;
const JERSEY_TARGET_HEIGHT = 285;
const JERSEY_MAX_WIDTH = 250;
const ALPHA_THRESHOLD = 14;
const WHITE_THRESHOLD = 246;

function getAlphaBounds(imageData, width, height) {
  const data = imageData.data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] > ALPHA_THRESHOLD) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) return null;
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function getOpaqueBoundsFromCanvas(ctx, width, height) {
  return getAlphaBounds(ctx.getImageData(0, 0, width, height), width, height);
}

/** Recadre les marges blanches avant détourage (photos packshot). */
async function trimWhiteMargins(bytes, mimeType) {
  const img = await loadImageFromBytes(bytes, mimeType);
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas indisponible.");
  ctx.drawImage(img, 0, 0);

  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data: px, width, height } = data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = px[i];
      const g = px[i + 1];
      const b = px[i + 2];
      const a = px[i + 3];
      const isBackground =
        a < ALPHA_THRESHOLD ||
        (r >= WHITE_THRESHOLD && g >= WHITE_THRESHOLD && b >= WHITE_THRESHOLD);
      if (!isBackground) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return bytes;
  }

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;
  const cropped = document.createElement("canvas");
  cropped.width = cropW;
  cropped.height = cropH;
  const cropCtx = cropped.getContext("2d");
  if (!cropCtx) return bytes;
  cropCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
  return canvasToPngBytes(cropped);
}

/**
 * Recadre sur les pixels visibles du maillot, redimensionne à hauteur fixe,
 * centre dans un canvas 328×411 transparent pour un rendu homogène.
 */
async function normalizeJerseyPng(pngBytes) {
  const img = await loadImageFromBytes(pngBytes, "image/png");
  const source = document.createElement("canvas");
  source.width = img.width;
  source.height = img.height;
  const sourceCtx = source.getContext("2d", { willReadFrequently: true });
  if (!sourceCtx) throw new Error("Canvas indisponible.");
  sourceCtx.drawImage(img, 0, 0);

  const bounds = getOpaqueBoundsFromCanvas(sourceCtx, source.width, source.height);
  if (!bounds) {
    throw new Error("Aucun contour de maillot détecté après détourage.");
  }

  const cropped = document.createElement("canvas");
  cropped.width = bounds.width;
  cropped.height = bounds.height;
  const croppedCtx = cropped.getContext("2d");
  if (!croppedCtx) throw new Error("Canvas indisponible.");
  croppedCtx.drawImage(
    source,
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
    0,
    0,
    bounds.width,
    bounds.height,
  );

  const scale = Math.min(JERSEY_TARGET_HEIGHT / bounds.height, JERSEY_MAX_WIDTH / bounds.width);
  const targetW = Math.max(1, Math.round(bounds.width * scale));
  const targetH = Math.max(1, Math.round(bounds.height * scale));

  const scaled = document.createElement("canvas");
  scaled.width = targetW;
  scaled.height = targetH;
  const scaledCtx = scaled.getContext("2d");
  if (!scaledCtx) throw new Error("Canvas indisponible.");
  scaledCtx.imageSmoothingEnabled = true;
  scaledCtx.imageSmoothingQuality = "high";
  scaledCtx.drawImage(cropped, 0, 0, targetW, targetH);

  const output = document.createElement("canvas");
  output.width = NORM_CARD_W;
  output.height = NORM_CARD_H;
  const outputCtx = output.getContext("2d");
  if (!outputCtx) throw new Error("Canvas indisponible.");
  outputCtx.clearRect(0, 0, NORM_CARD_W, NORM_CARD_H);
  outputCtx.drawImage(
    scaled,
    Math.round((NORM_CARD_W - targetW) / 2),
    Math.round((NORM_CARD_H - targetH) / 2),
    targetW,
    targetH,
  );

  return canvasToPngBytes(output);
}

// Généré par scripts/build.mjs — ne pas éditer à la main.
const PLUGIN_API_ORIGIN = "https://foot-shop.onrender.com";
const PLUGIN_API_ORIGINS = ["https://foot-shop.onrender.com","https://foot-shop.fr","https://www.foot-shop.fr"];
const PLUGIN_ADMIN_SECRET = "mdp";
const PLUGIN_CATEGORIES = [{"id":14,"name":"Maillots"},{"id":15,"name":"Shorts"},{"id":16,"name":"Enfant - Short"},{"id":17,"name":"Ligue 1"},{"id":18,"name":"Premier League"},{"id":19,"name":"La Liga"},{"id":20,"name":"Serie A"},{"id":21,"name":"Bundesliga"},{"id":22,"name":"Ligue des champions"},{"id":23,"name":"Sélections"},{"id":24,"name":"Ligue 1"},{"id":25,"name":"Premier League"},{"id":26,"name":"La Liga"},{"id":27,"name":"Serie A"},{"id":28,"name":"Bundesliga"},{"id":29,"name":"Ligue des champions"},{"id":30,"name":"Sélections"},{"id":31,"name":"Ligue 1"},{"id":32,"name":"Premier League"},{"id":33,"name":"La Liga"},{"id":34,"name":"Serie A"},{"id":35,"name":"Bundesliga"},{"id":36,"name":"Ligue des champions"},{"id":37,"name":"Sélections"},{"id":38,"name":"CDM"},{"id":39,"name":"Ligue 1"},{"id":40,"name":"Premier League"},{"id":41,"name":"La Liga"},{"id":42,"name":"Serie A"},{"id":43,"name":"Bundesliga"},{"id":44,"name":"Ligue des champions"},{"id":45,"name":"Sélections"},{"id":11,"name":"World Cup"},{"id":12,"name":"Maillot - Enfant"},{"id":13,"name":"CDM"}];
const PLUGIN_DEFAULT_CATEGORY_ID = "11";

let batchCancelled = false;
let fetchAbort = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getFetchSignal() {
  return fetchAbort?.signal;
}

function checkCancelled() {
  if (batchCancelled) {
    const err = new Error("Annulé.");
    err.name = "AbortError";
    throw err;
  }
}

function resetBatchState() {
  batchCancelled = false;
  if (fetchAbort) fetchAbort.abort();
  fetchAbort = new AbortController();
}

function cancelBatch() {
  batchCancelled = true;
  if (fetchAbort) fetchAbort.abort();
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function loadImageFromBytes(bytes, mimeType) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([bytes], { type: mimeType || "image/png" });
    const objectUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Impossible de lire l'image."));
    };
    img.src = objectUrl;
  });
}

function canvasToPngBytes(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error("Export PNG impossible."));
        return;
      }
      resolve(new Uint8Array(await blob.arrayBuffer()));
    }, "image/png");
  });
}

function colorDistance(r1, g1, b1, r2, g2, b2) {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function medianChannel(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

/** Échantillonne les coins et bords pour estimer la couleur de fond. */
function detectBackgroundRefs(data, width, height) {
  const samples = [];
  const step = Math.max(2, Math.floor(Math.min(width, height) / 40));

  const add = (x, y) => {
    const i = (y * width + x) * 4;
    const a = data[i + 3];
    if (a < 20) return;
    samples.push([data[i], data[i + 1], data[i + 2]]);
  };

  for (let x = 0; x < width; x += step) {
    add(x, 0);
    add(x, height - 1);
  }
  for (let y = 0; y < height; y += step) {
    add(0, y);
    add(width - 1, y);
  }

  if (!samples.length) return [[255, 255, 255]];

  const rs = samples.map((s) => s[0]);
  const gs = samples.map((s) => s[1]);
  const bs = samples.map((s) => s[2]);
  const primary = [medianChannel(rs), medianChannel(gs), medianChannel(bs)];

  const refs = [primary];
  const whiteish = [250, 250, 250];
  const grayish = [240, 240, 240];
  if (colorDistance(primary[0], primary[1], primary[2], whiteish[0], whiteish[1], whiteish[2]) > 18) {
    refs.push(whiteish);
  }
  if (colorDistance(primary[0], primary[1], primary[2], grayish[0], grayish[1], grayish[2]) > 18) {
    refs.push(grayish);
  }

  return refs;
}

function matchesBackground(r, g, b, refs, tolerance) {
  for (const [br, bg, bb] of refs) {
    if (colorDistance(r, g, b, br, bg, bb) <= tolerance) return true;
  }
  return false;
}

function floodFillBackground(mask, data, width, height, refs, tolerance) {
  const queue = [];
  const idx = (x, y) => y * width + x;

  const tryPush = (x, y) => {
    const p = idx(x, y);
    if (mask[p]) return;
    const i = p * 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 20) {
      mask[p] = 1;
      queue.push(p);
      return;
    }
    if (matchesBackground(r, g, b, refs, tolerance)) {
      mask[p] = 1;
      queue.push(p);
    }
  };

  for (let x = 0; x < width; x++) {
    tryPush(x, 0);
    tryPush(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    tryPush(0, y);
    tryPush(width - 1, y);
  }

  while (queue.length) {
    const p = queue.pop();
    const x = p % width;
    const y = (p - x) / width;
    if (x > 0) tryPush(x - 1, y);
    if (x < width - 1) tryPush(x + 1, y);
    if (y > 0) tryPush(x, y - 1);
    if (y < height - 1) tryPush(x, y + 1);
  }
}

function featherEdges(data, width, height, mask, refs, hardTol, softTol) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (mask[p]) continue;
      const i = p * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      let minDist = Infinity;
      for (const [br, bg, bb] of refs) {
        minDist = Math.min(minDist, colorDistance(r, g, b, br, bg, bb));
      }

      if (minDist <= hardTol) {
        data[i + 3] = 0;
      } else if (minDist <= softTol) {
        const t = (minDist - hardTol) / (softTol - hardTol);
        data[i + 3] = Math.round(Math.min(255, data[i + 3] * t));
      }
    }
  }
}

/** Détourage local — fond uni ou légèrement dégradé (packshots maillots). */
async function removeBackgroundLocally(bytes, mimeType) {
  const img = await loadImageFromBytes(bytes, mimeType);
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas indisponible.");
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data, width, height } = imageData;
  const refs = detectBackgroundRefs(data, width, height);
  const hardTol = 42;
  const softTol = 72;

  const mask = new Uint8Array(width * height);
  floodFillBackground(mask, data, width, height, refs, hardTol);

  for (let p = 0; p < width * height; p++) {
    if (mask[p]) data[p * 4 + 3] = 0;
  }

  featherEdges(data, width, height, mask, refs, hardTol, softTol);
  ctx.putImageData(imageData, 0, 0);
  return canvasToPngBytes(canvas);
}

const DETAIL_BAD =
  /detail|zoom|macro|closeup|close[_-]?up|crop|patch|badge|logo|label|tag|size[_-]?chart|size[_-]?guide|measure|fabric|texture|sponsor|collar|neck|sleeve|button|stitch|embroidery|crest|numero|number|print|close|fragment|part|section|area|focus|thumb|mini|small|preview|banner|hero|slider|nav|related|recommend|similar|also|bundle|set|pair|shorts|pant|sock|ball|cap|hat|shoe|sneaker|kids?[_-]?model|child[_-]?model/i;

const BACK_SIDE_STRICT =
  /back|dos|verso|rear|_b\b|_back|vue[_-]?2\b|side|profil|lateral|_s\b|_side|vue[_-]?3\b|inside|interior|lining|2\.(?:jpe?g|png|webp)|_2\.(?:jpe?g|png|webp)|\/2[\./_-]|image[_-]?2|photo[_-]?2|pic[_-]?2/i;

/** Rejette dos, profil, zoom détail, accessoires… */
function isDefinitelyNotFront(url, alt = "", context = "", galleryIndex = 99) {
  const hay = `${url} ${alt} ${context}`.toLowerCase();

  if (/front|face|avant|recto|_f\b|_front|vue[_-]?1\b|1\.(?:jpe?g|png|webp)|_1\.(?:jpe?g|png|webp)|image[_-]?1|photo[_-]?1|pic[_-]?1/i.test(hay)) {
    if (!BACK_SIDE_STRICT.test(hay) && !DETAIL_BAD.test(hay)) return false;
  }

  if (BACK_SIDE_STRICT.test(hay)) return true;
  if (DETAIL_BAD.test(hay)) return true;
  if (galleryIndex > 0 && !/front|face|avant|recto|gallery|product|main/i.test(hay)) {
    if (/2\.|_2\.|\/2[./_-]|image.?2|photo.?2/i.test(hay)) return true;
  }

  return false;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, options = {}, retries = 4) {
  let lastError = "failed to fetch";

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      if (typeof checkCancelled === "function") checkCancelled();

      const res = await fetch(url, {
        ...options,
        signal: options.signal,
      });

      if (res.ok) return res;

      if (res.status === 403 || res.status === 429 || res.status >= 500) {
        lastError = `HTTP ${res.status}`;
        await sleep(600 * (attempt + 1));
        continue;
      }

      throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") throw err;
      lastError = err instanceof Error ? err.message : lastError;
      if (attempt < retries - 1) await sleep(600 * (attempt + 1));
    }
  }

  throw new Error(lastError);
}

/**
 * Analyse le contenu : packshot maillot de face à plat sur fond uni.
 * Rejette zooms, détails, bannières…
 */
async function analyzePackshot(bytes, mimeType) {
  const img = await loadImageFromBytes(bytes, mimeType);
  const width = img.width;
  const height = img.height;

  if (width < 320 || height < 320) {
    return { ok: false, score: -100, reason: "image trop petite" };
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { ok: false, score: -100, reason: "canvas indisponible" };

  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, width, height);
  const refs = detectBackgroundRefs(data, width, height);

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let bgEdge = 0;
  let edgeTotal = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      const onEdge = x < 3 || y < 3 || x >= width - 3 || y >= height - 3;
      if (onEdge) {
        edgeTotal++;
        if (matchesBackground(r, g, b, refs, 50)) bgEdge++;
      }

      const isBg = a < 20 || matchesBackground(r, g, b, refs, 44);
      if (!isBg) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return { ok: false, score: -100, reason: "aucun sujet détecté" };
  }

  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  const fillRatio = (bw * bh) / (width * height);
  const aspect = bh / bw;
  const centerX = (minX + maxX) / 2;
  const centerOffset = Math.abs(centerX - width / 2) / width;
  const bgUniformity = edgeTotal ? bgEdge / edgeTotal : 0;

  let score = 0;
  let ok = true;
  let reason = "";

  if (bgUniformity < 0.55) {
    score -= 40;
    ok = false;
    reason = "fond non uniforme";
  }

  if (fillRatio > 0.76) {
    score -= 50;
    ok = false;
    reason = reason || "cadrage trop serré (zoom)";
  } else if (fillRatio > 0.68) {
    score -= 25;
  } else if (fillRatio >= 0.28 && fillRatio <= 0.62) {
    score += 35;
  } else if (fillRatio < 0.22) {
    score -= 40;
    ok = false;
    reason = reason || "maillot trop petit dans l'image";
  }

  if (aspect < 0.95 || aspect > 1.85) {
    score -= 30;
    ok = false;
    reason = reason || "proportions atypiques";
  } else if (aspect >= 1.1 && aspect <= 1.55) {
    score += 25;
  }

  if (centerOffset > 0.18) {
    score -= 20;
    if (centerOffset > 0.28) {
      ok = false;
      reason = reason || "sujet décentré";
    }
  } else {
    score += 10;
  }

  if (width >= 600 && height >= 600) score += 8;

  return { ok, score, reason, fillRatio, aspect };
}

async function validatePackshot(bytes, mimeType) {
  const analysis = await analyzePackshot(bytes, mimeType);
  return analysis.ok;
}

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

const categorySelect = document.getElementById("categoryId");
const reloadCategoriesBtn = document.getElementById("reloadCategoriesBtn");
const networkPanel = document.getElementById("networkPanel");
const networkTestBtn = document.getElementById("networkTestBtn");
const urlInput = document.getElementById("productUrl");
const prepareBtn = document.getElementById("prepareBtn");
const pushBtn = document.getElementById("pushBtn");
const cancelBtn = document.getElementById("cancelBtn");
const pendingListEl = document.getElementById("pendingList");
const statusEl = document.getElementById("status");

const FIGMA_PRICE = 24.99;
const FIGMA_STOCK = 20;

if (prepareBtn) prepareBtn.disabled = false;
if (statusEl && categorySelect?.options.length) {
  statusEl.textContent = `${categorySelect.options.length} catégorie(s) — plugin prêt.`;
}

/** @type {{ url: string; name: string; frameId: string; status: string; productId?: string }[]} */
let pendingQueue = [];
let requestCounter = 0;

function getApiOrigins() {
  const origins = [];
  const add = (value) => {
    const normalized = String(value || "").replace(/\/$/, "");
    if (normalized && !origins.includes(normalized)) origins.push(normalized);
  };

  if (typeof PLUGIN_API_ORIGINS !== "undefined" && Array.isArray(PLUGIN_API_ORIGINS)) {
    for (const origin of PLUGIN_API_ORIGINS) add(origin);
  }
  add(typeof PLUGIN_API_ORIGIN !== "undefined" ? PLUGIN_API_ORIGIN : "");
  add("https://foot-shop.fr");
  add("https://foot-shop.onrender.com");
  add("https://www.foot-shop.fr");
  return origins;
}

function getApiOrigin() {
  return getApiOrigins()[0] || "https://foot-shop.fr";
}

function isNetworkError(message) {
  return /network error|failed to fetch|fetch failed|load failed|aborted|délai dépassé/i.test(
    message,
  );
}

function setStatus(text, isError) {
  statusEl.textContent = text;
  statusEl.className = isError ? "error" : "";
}

function setBusy(busy) {
  prepareBtn.disabled = busy;
  pushBtn.disabled = busy || !pendingQueue.some((p) => p.status.startsWith("Prêt"));
  cancelBtn.disabled = !busy;
}

function nextRequestId() {
  requestCounter += 1;
  return `req-${requestCounter}`;
}

function renderPending() {
  if (!pendingQueue.length) {
    pendingListEl.innerHTML = '<div class="pending-item">Aucune fiche en attente.</div>';
    pushBtn.disabled = true;
    return;
  }

  pendingListEl.innerHTML = pendingQueue
    .map(
      (item) =>
        `<div class="pending-item"><strong>${escapeHtml(item.name)}</strong><div class="meta">${escapeHtml(item.status)}</div></div>`,
    )
    .join("");

  pushBtn.disabled = !pendingQueue.some((p) => p.status.startsWith("Prêt"));
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function waitForPluginMessage(type, requestId) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      window.removeEventListener("message", handler);
      reject(new Error("Délai dépassé (plugin Figma)."));
    }, 120000);

    const handler = (event) => {
      const msg = event.data.pluginMessage;
      if (!msg || msg.requestId !== requestId) return;

      if (msg.type === type) {
        clearTimeout(timeout);
        window.removeEventListener("message", handler);
        resolve(msg);
      }

      if (msg.type === "card-error" || msg.type === "export-error" || msg.type === "scrape-error") {
        clearTimeout(timeout);
        window.removeEventListener("message", handler);
        reject(new Error(msg.message || "Erreur plugin."));
      }
    };

    window.addEventListener("message", handler);
  });
}

function getApiSecret() {
  return typeof PLUGIN_ADMIN_SECRET === "string" ? PLUGIN_ADMIN_SECRET : "";
}

function waitForApiResponse(requestId, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      window.removeEventListener("message", handler);
      reject(new Error("Délai dépassé (API plugin)."));
    }, timeoutMs);

    const handler = (event) => {
      const msg = event.data.pluginMessage;
      if (!msg || msg.requestId !== requestId || msg.type !== "api-response") return;

      clearTimeout(timeout);
      window.removeEventListener("message", handler);

      if (msg.error) {
        reject(new Error(msg.error));
        return;
      }

      let data = {};
      try {
        data = msg.body ? JSON.parse(msg.body) : {};
      } catch {
        data = {};
      }

      resolve({ ok: msg.ok, status: msg.status, data });
    };

    window.addEventListener("message", handler);
  });
}

async function pluginApiViaMain(path, options = {}, timeoutMs = 120000) {
  const requestId = nextRequestId();
  parent.postMessage(
    {
      pluginMessage: {
        type: "api-request",
        requestId,
        path,
        method: options.method || "GET",
        headers: options.headers,
        body: options.body,
      },
    },
    "*",
  );
  return waitForApiResponse(requestId, timeoutMs);
}

async function pluginApiOnce(origin, path, options = {}, timeoutMs = 120000) {
  const url = `${origin.replace(/\/$/, "")}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers = {
      Authorization: `Bearer ${getApiSecret()}`,
      "x-admin-secret": getApiSecret(),
      ...(options.headers || {}),
    };
    if (options.body && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    const res = await fetch(url, {
      method: options.method || "GET",
      headers,
      body: options.body,
      signal: controller.signal,
    });

    let data = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }

    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Délai dépassé — le serveur ne répond pas (Render peut mettre ~1 min au 1er appel).");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function pluginApi(path, options = {}, timeoutMs = 120000) {
  // Thread principal Figma : pas de CORS, accès réseau du manifest.
  try {
    return await pluginApiViaMain(path, options, timeoutMs);
  } catch (mainErr) {
    const mainMsg = mainErr instanceof Error ? mainErr.message : String(mainErr);
    if (!isNetworkError(mainMsg)) throw mainErr;
  }

  const errors = [];
  for (const origin of getApiOrigins()) {
    try {
      return await pluginApiOnce(origin, path, options, timeoutMs);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(err instanceof Error ? err : new Error(message));
      if (!isNetworkError(message)) throw err;
    }
  }

  throw errors[0] ?? new Error("Failed to fetch");
}

async function apiFetch(path, body) {
  const { ok, status, data } = await pluginApi(path, {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!ok) {
    throw new Error(data.message || `Erreur API (${status})`);
  }
  return data;
}

function explainApiError(status, message) {
  if (status === 401) {
    return "Accès refusé — vérifie ADMIN_SECRET=mdp sur le serveur (Render).";
  }
  if (status === 404) {
    return "Route API introuvable — déploie la dernière version du site sur foot-shop.fr.";
  }
  if (status === 503 && message === "prestashop_not_configured") {
    return "PrestaShop non configuré sur le serveur (PRESTASHOP_API_URL / KEY).";
  }
  return message || `Erreur ${status}`;
}

function applyCategoryOptions(list, savedCategoryId, defaultCategoryId) {
  if (!list.length) return false;

  categorySelect.innerHTML = list
    .map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`)
    .join("");

  const pickId = savedCategoryId || defaultCategoryId || list[0]?.id || "";
  if (pickId) categorySelect.value = pickId;
  return true;
}

function loadEmbeddedCategories(savedCategoryId) {
  if (typeof PLUGIN_CATEGORIES === "undefined" || !PLUGIN_CATEGORIES.length) {
    return false;
  }

  const defaultId =
    typeof PLUGIN_DEFAULT_CATEGORY_ID !== "undefined" ? PLUGIN_DEFAULT_CATEGORY_ID : "";
  applyCategoryOptions(PLUGIN_CATEGORIES, savedCategoryId, defaultId);
  setStatus(`${PLUGIN_CATEGORIES.length} catégorie(s) (cache) — sync serveur…`);
  return true;
}

async function loadCategories(savedCategoryId) {
  const hadCache = loadEmbeddedCategories(savedCategoryId);
  if (!hadCache) {
    categorySelect.innerHTML = '<option value="">Chargement…</option>';
    setStatus(`Connexion à ${getApiOrigin()}…`);
  }

  const endpoints = ["/api/admin/product-import", "/api/admin/figma-import"];
  let lastError = "Catégories indisponibles";

  for (const path of endpoints) {
    try {
      setStatus(`Sync ${path}…`);
      const { ok, status, data } = await pluginApi(path);

      if (status === 404) {
        lastError = explainApiError(404, data.message);
        continue;
      }

      if (!ok) {
        lastError = `${explainApiError(status, data.message)} [${status}]`;
        if (PLUGIN_CATEGORIES?.length) {
          setStatus(`${PLUGIN_CATEGORIES.length} catégorie(s) en cache — ${lastError}`, true);
          return true;
        }
        break;
      }

      const list = data.categories || [];
      if (!list.length) {
        lastError = "Aucune catégorie PrestaShop";
        continue;
      }

      applyCategoryOptions(list, savedCategoryId, data.defaultCategoryId);
      setStatus(`${list.length} catégorie(s) synchronisée(s).`);
      return true;
    } catch (err) {
      lastError = formatError(err);
    }
  }

  if (PLUGIN_CATEGORIES?.length) {
    setStatus(`${PLUGIN_CATEGORIES.length} catégorie(s) en cache — sync échouée : ${lastError}`, true);
    return true;
  }

  categorySelect.innerHTML = `<option value="">${escapeHtml(lastError)}</option>`;
  setStatus(`Catégories : ${lastError}`, true);
  return false;
}

function saveCategorySelection() {
  parent.postMessage(
    { pluginMessage: { type: "save-category", categoryId: categorySelect.value } },
    "*",
  );
}

async function scrapeViaMain(url) {
  const requestId = nextRequestId();
  parent.postMessage(
    { pluginMessage: { type: "scrape-product", requestId, url } },
    "*",
  );
  return waitForPluginMessage("scrape-done", requestId);
}

async function apiGet(path, query, timeoutMs = 120000) {
  const params = new URLSearchParams();
  const secret = getApiSecret();
  if (secret) params.set("pluginSecret", secret);
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, value);
  }
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const { ok, status, data } = await pluginApi(`${path}${suffix}`, {}, timeoutMs);
  if (!ok) {
    throw new Error(data.message || `Erreur API (${status})`);
  }
  return data;
}

async function scrapeViaApiPost(url) {
  for (const path of ["/api/admin/figma-import", "/api/admin/product-import"]) {
    try {
      const data = await apiFetch(path, { action: "scrape", url });
      if (!data.imageBase64) {
        throw new Error("Image serveur manquante.");
      }
      return {
        name: data.name || "Maillot",
        mimeType: data.mimeType || "image/jpeg",
        bytes: Array.from(base64ToBytes(data.imageBase64)),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/404|introuvable|unknown_action/i.test(message)) continue;
      throw err;
    }
  }
  throw new Error("scrape_api_unavailable");
}

async function scrapeProduct(url) {
  const apiErrors = [];

  setStatus("Scrape via serveur Foot Shop (Render)…");
  try {
    return await scrapeViaApiPost(url);
  } catch (err) {
    apiErrors.push(err instanceof Error ? err.message : String(err));
  }

  for (const path of ["/api/admin/figma-import", "/api/admin/product-import"]) {
    try {
      setStatus("Analyse via API Foot Shop…");
      const preview = await apiGet(path, { previewUrl: url }, 120000);
      if (!preview.imageUrl) {
        throw new Error("Aucune image produit trouvée sur cette page.");
      }

      const image = await apiGet(
        path,
        {
          imageUrl: preview.imageUrl,
          referer: preview.sourceUrl || url,
        },
        120000,
      );

      if (!image.imageBase64) {
        throw new Error("Image serveur manquante.");
      }

      return {
        name: preview.name || "Maillot",
        mimeType: image.mimeType || "image/jpeg",
        bytes: Array.from(base64ToBytes(image.imageBase64)),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      apiErrors.push(message);
      if (/404|introuvable|unknown_action/i.test(message)) continue;
      break;
    }
  }

  setStatus("API indisponible — scrape Figma local (fournisseur)…");
  try {
    const scraped = await scrapeViaMain(url);
    return {
      name: scraped.name || "Maillot",
      mimeType: scraped.mimeType || "image/jpeg",
      bytes: scraped.bytes,
    };
  } catch (localErr) {
    const localMsg = formatError(localErr, "scrape");
    const apiHint = apiErrors.filter(Boolean).slice(-2).join(" · ");
    throw new Error(
      apiHint
        ? `API Foot Shop : ${apiHint} · ${localMsg}`
        : localMsg,
    );
  }
}

async function previewFromApi(url) {
  for (const path of ["/api/admin/figma-import", "/api/admin/product-import"]) {
    try {
      return await apiFetch(path, { action: "preview", url });
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (/404|introuvable|unknown_action/i.test(message)) continue;
      throw err;
    }
  }
  throw new Error("Preview indisponible — déploie la dernière version du site.");
}

async function pushToPrestaShop(item, imageBase64) {
  const payload = {
    action: "push",
    name: item.name,
    sourceUrl: item.url,
    imageBase64,
    imageMime: "image/png",
    categoryId: categorySelect.value || undefined,
    price: FIGMA_PRICE,
    stock: FIGMA_STOCK,
  };

  for (const path of ["/api/admin/figma-import", "/api/admin/product-import"]) {
    try {
      return await apiFetch(path, payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (/404|introuvable|unknown_action/i.test(message)) continue;
      throw err;
    }
  }
  throw new Error("Envoi PrestaShop indisponible — déploie la dernière version du site.");
}

async function runPipelineToBytes(sourceBytes, mimeType) {
  checkCancelled();
  const trimmed = await trimWhiteMargins(sourceBytes, mimeType);
  checkCancelled();
  const cutout = await removeBackgroundLocally(trimmed, "image/png");
  checkCancelled();
  return normalizeJerseyPng(cutout);
}

async function createFigmaCard(normalizedBytes, meta) {
  const requestId = nextRequestId();
  parent.postMessage(
    {
      pluginMessage: {
        type: "apply-result",
        requestId,
        nodeName: meta.name,
        sourceUrl: meta.url,
        placementIndex: meta.placementIndex,
        batchTotal: meta.batchTotal,
        bytes: Array.from(normalizedBytes),
      },
    },
    "*",
  );

  const msg = await waitForPluginMessage("card-created", requestId);
  return { frameId: msg.frameId, nodeName: msg.nodeName };
}

async function exportFigmaFrame(frameId) {
  const requestId = nextRequestId();
  parent.postMessage(
    { pluginMessage: { type: "export-frame", requestId, frameId } },
    "*",
  );
  const msg = await waitForPluginMessage("frame-exported", requestId);
  return new Uint8Array(msg.bytes);
}

function canonicalProductUrl(raw) {
  let value = String(raw || "").trim();
  value = value
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/^[Ee]rreur\s*:\s*(?:URL invalide\s*:\s*)?/i, "");

  const match = value.match(/https?:\/\/[^\s<>"']+/i);
  if (match) value = match[0];

  value = value.replace(/[\u2026…]+$/g, "").replace(/[)\]},.;]+$/g, "");
  while (/%[0-9A-Fa-f]?$/.test(value)) {
    value = value.replace(/(%[0-9A-Fa-f]?)+$/g, "");
  }

  if (!/^https?:\/\//i.test(value)) {
    value = `https://${value.replace(/^\/+/, "")}`;
  }

  value = value.split(/[?#]/)[0];
  const parsed = value.match(/^(https?):\/\/([^/?#]+)(\/[^?#]*)?$/i);
  if (!parsed) {
    throw new Error(`URL invalide : ${value.slice(0, 120)}${value.length > 120 ? "…" : ""}`);
  }

  return `${parsed[1].toLowerCase()}://${parsed[2]}${parsed[3] || "/"}`;
}

function parseUrlLines(text) {
  const cleaned = text.replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
  if (!cleaned) return [];

  const lines = cleaned.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const chunks = [];

  for (const line of lines) {
    if (/^[Ee]rreur\s*:/.test(line)) continue;

    const extracted = line.match(/https?:\/\/[^\s<>"']+/gi);
    if (extracted) {
      for (const raw of extracted) {
        const url = raw.replace(/[)\]},.;]+$/g, "").replace(/[\u2026…]+$/g, "");
        if (url && !chunks.includes(url)) chunks.push(url);
      }
      continue;
    }

    if (/^https?:\/\//i.test(line)) {
      chunks.push(line.replace(/[)\]},.;]+$/g, "").replace(/[\u2026…]+$/g, ""));
    } else if (chunks.length && !/\s/.test(line)) {
      chunks[chunks.length - 1] += line.replace(/[)\]},.;]+$/g, "").replace(/[\u2026…]+$/g, "");
    }
  }

  const canonical = [];
  for (const chunk of chunks) {
    try {
      const url = canonicalProductUrl(chunk);
      if (!canonical.includes(url)) canonical.push(url);
    } catch {
      // ignore invalid fragments
    }
  }

  return canonical;
}

function formatError(err, context = "auto") {
  if (err instanceof Error && err.name === "AbortError") return "Annulé.";
  const message = err instanceof Error ? err.message : "Erreur inconnue";
  if (
    /^(Téléchargement page\/image|Connexion foot-shop|Accès refusé|Route API|Réseau Figma bloqué|API Foot Shop)/.test(
      message,
    )
  ) {
    return message;
  }
  if (isNetworkError(message)) {
    if (context === "scrape" || /Réseau Figma bloqué|HTTP \d|Impossible de télécharger/i.test(message)) {
      return message.includes("Réseau Figma bloqué")
        ? message
        : `Téléchargement page/image impossible (${message}) — importe manifest.json v3 et lance le plugin « v3 ».`;
    }
    return `Connexion foot-shop.fr impossible — déploie la dernière version sur Render, reload le plugin, réessaie. (${message})`;
  }
  if (/unauthorized|401/i.test(message)) {
    return "Accès refusé — ADMIN_SECRET du plugin (build) ≠ celui sur Render.";
  }
  return message;
}

function describeNetworkChecks(checks) {
  if (!checks?.length) return "";

  const failed = checks.filter((check) => !check.ok);
  const internetOk = checks.some((check) => check.ok && check.label === "internet");
  const onrenderOk = checks.some((check) => check.ok && check.label === "foot-shop.onrender.com");
  const footShopOk = checks.some(
    (check) => check.ok && (check.label === "foot-shop.fr" || check.label === "www.foot-shop.fr"),
  );

  if (failed.length === checks.length) {
    return "Réseau Figma totalement bloqué — importe manifest.json v3 (Import plugin from manifest), lance « Foot Shop - Import maillot v3 ».";
  }

  if (internetOk && (onrenderOk || footShopOk)) {
    return "Réseau OK — le serveur Foot Shop est joignable depuis Figma.";
  }

  if (internetOk && !onrenderOk && !footShopOk) {
    return "Internet OK mais Foot Shop injoignable — déploie maillot-store sur Render (foot-shop.onrender.com).";
  }

  if (failed.length) {
    return `Réseau partiel : ${failed.map((check) => check.label).join(", ")} inaccessible(s).`;
  }

  return "Réseau OK.";
}

function renderNetworkChecks(checks) {
  if (!networkPanel) return;
  if (!checks?.length) {
    networkPanel.textContent = "Aucun test réseau.";
    return;
  }

  networkPanel.innerHTML = checks
    .map((check) => {
      const icon = check.ok ? "✓" : "✗";
      const detail = check.ok ? `HTTP ${check.status}` : check.error || "bloqué";
      return `<div class="net-row ${check.ok ? "ok" : "fail"}">${icon} ${escapeHtml(check.label)} — ${escapeHtml(String(detail))}</div>`;
    })
    .join("");
}

async function runNetworkTest() {
  const requestId = nextRequestId();
  setStatus("Test réseau Figma…");
  parent.postMessage({ pluginMessage: { type: "network-test", requestId } }, "*");
  const msg = await waitForPluginMessage("network-test-result", requestId);
  renderNetworkChecks(msg.checks);
  const hint = describeNetworkChecks(msg.checks);
  setStatus(hint, /bloqué|injoignable|inaccessible/i.test(hint));
}

categorySelect.onchange = () => saveCategorySelection();

reloadCategoriesBtn.onclick = () => {
  void loadCategories(categorySelect.value || "");
};

if (networkTestBtn) {
  networkTestBtn.onclick = () => {
    void runNetworkTest();
  };
}

cancelBtn.onclick = () => {
  cancelBatch();
  setStatus("Annulé.");
  setBusy(false);
};

prepareBtn.onclick = async () => {
  const urls = parseUrlLines(urlInput.value);
  if (!urls.length) {
    setStatus("Collez au moins un lien produit.", true);
    return;
  }

  resetBatchState();
  pendingQueue = [];
  renderPending();
  setBusy(true);
  setStatus("Démarrage…");

  let ok = 0;
  try {
    for (let i = 0; i < urls.length; i++) {
      checkCancelled();
      const url = urls[i];

      try {
        setStatus(`${i + 1}/${urls.length} — Analyse page (Foot Shop)…`);
        const scraped = await scrapeProduct(url);
        const name = scraped.name || "Maillot";
        const bytes = new Uint8Array(scraped.bytes);
        const mimeType = scraped.mimeType || "image/jpeg";

        setStatus(`${i + 1}/${urls.length} — Validation packshot…`);
        const analysis = await analyzePackshot(bytes, mimeType);
        if (!analysis.ok) {
          throw new Error(analysis.reason || "Image non conforme (pas un packshot face).");
        }

        setStatus(`${i + 1}/${urls.length} — Détourage + normalisation…`);
        const normalized = await runPipelineToBytes(bytes, mimeType);

        setStatus(`${i + 1}/${urls.length} — Création fiche Figma…`);
        const card = await createFigmaCard(normalized, {
          name,
          url,
          placementIndex: ok,
          batchTotal: urls.length,
        });

        pendingQueue.push({
          url,
          name,
          frameId: card.frameId,
          status: "Prêt — en attente validation",
        });
        ok++;
        renderPending();
      } catch (err) {
        if (batchCancelled || (err instanceof Error && err.name === "AbortError")) break;
        pendingQueue.push({
          url,
          name: name || url.split("/").filter(Boolean).pop() || "Maillot",
          frameId: "",
          status: `Erreur : ${formatError(err)}`,
        });
        renderPending();
        await sleep(800);
      }
    }

    if (batchCancelled) {
      setStatus(`Annulé — ${ok} fiche(s) préparée(s).`, ok === 0);
    } else {
      setStatus(`${ok}/${urls.length} fiche(s) prête(s). Vérifie dans Figma puis valide.`, ok === 0);
    }
  } catch (err) {
    setStatus(formatError(err), true);
  }

  setBusy(false);
};

pushBtn.onclick = async () => {
  const ready = pendingQueue.filter((p) => p.status.startsWith("Prêt") && p.frameId);
  if (!ready.length) {
    setStatus("Aucune fiche prête à envoyer.", true);
    return;
  }

  resetBatchState();
  setBusy(true);

  let ok = 0;
  try {
    for (let i = 0; i < ready.length; i++) {
      checkCancelled();
      const item = ready[i];
      setStatus(`${i + 1}/${ready.length} — Export Figma ${item.name.slice(0, 36)}…`);

      const pngBytes = await exportFigmaFrame(item.frameId);
      const base64 = bytesToBase64(pngBytes);

      setStatus(`${i + 1}/${ready.length} — Envoi PrestaShop…`);
      const result = await pushToPrestaShop(item, base64);

      item.status = `Envoyé ✓ (#${result.result?.productId || "?"})`;
      item.productId = result.result?.productId;
      ok++;
      renderPending();
    }

    setStatus(`${ok}/${ready.length} produit(s) créé(s) sur PrestaShop ✓`, ok === 0);
  } catch (err) {
    setStatus(formatError(err), true);
  }

  setBusy(false);
};

window.onmessage = (event) => {
  const msg = event.data.pluginMessage;
  if (!msg) return;

  if (msg.type === "init") {
    if (categorySelect.options.length > 1 && msg.categoryId) {
      categorySelect.value = msg.categoryId;
    }
    renderNetworkChecks(msg.networkChecks);
    const networkHint = describeNetworkChecks(msg.networkChecks);
    if (networkHint) {
      const isError = /bloqué|injoignable|inaccessible/i.test(networkHint);
      setStatus(networkHint, isError);
    }
  }

  if (msg.type === "network-test-result") {
    // handled by waitForPluginMessage
  }
};

window.onerror = (_message, _source, _line, _col, err) => {
  setStatus(err instanceof Error ? err.message : "Erreur JavaScript.", true);
  setBusy(false);
};

renderPending();
parent.postMessage({ pluginMessage: { type: "ui-ready" } }, "*");

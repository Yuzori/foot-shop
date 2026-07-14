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

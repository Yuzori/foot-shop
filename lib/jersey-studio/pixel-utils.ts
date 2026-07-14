type Rgb = [number, number, number];

export function colorDistance(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number,
): number {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function medianChannel(values: number[]): number {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

export function detectBackgroundRefs(
  data: Uint8Array,
  width: number,
  height: number,
): Rgb[] {
  const samples: Rgb[] = [];
  const step = Math.max(2, Math.floor(Math.min(width, height) / 40));

  const add = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    const a = data[i + 3] ?? 0;
    if (a < 20) return;
    samples.push([data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0]);
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

  const primary: Rgb = [
    medianChannel(samples.map((s) => s[0])),
    medianChannel(samples.map((s) => s[1])),
    medianChannel(samples.map((s) => s[2])),
  ];

  const refs: Rgb[] = [primary];
  const whiteish: Rgb = [250, 250, 250];
  const grayish: Rgb = [240, 240, 240];
  if (colorDistance(...primary, ...whiteish) > 18) refs.push(whiteish);
  if (colorDistance(...primary, ...grayish) > 18) refs.push(grayish);
  return refs;
}

export function matchesBackground(
  r: number,
  g: number,
  b: number,
  refs: Rgb[],
  tolerance: number,
): boolean {
  if (isJerseyFabricPixel(r, g, b)) return false;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min > 32) return false;

  for (const [br, bg, bb] of refs) {
    if (colorDistance(r, g, b, br, bg, bb) <= tolerance) return true;
  }
  return false;
}

/** Fond studio blanc / gris neutre (#FFF, #F8F8F8…) — jamais du tissu. */
export function isStudioBackgroundPixel(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max - min;
  if (sat > 14) return false;
  if (min >= 240) return true;
  return false;
}

/**
 * Tissu du maillot (rouge, bleu, jaune, orange…) — ne jamais confondre avec le fond blanc/gris.
 * Les JPEG éclaircissent le rouge en rose pâle (255,230,230) : distance RGB proche du blanc
 * mais c'est du tissu, pas du fond.
 */
export function isJerseyFabricPixel(r: number, g: number, b: number): boolean {
  if (isStudioBackgroundPixel(r, g, b)) return false;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max - min;

  if (r >= 90 && r > g + 4 && r > b + 4) return true;
  if (b >= 50 && b > r + 4 && b > g + 4) return true;
  if (g >= 90 && r >= 70 && g > b + 4 && r > b + 4) return true;
  if (r >= 130 && g >= 60 && b <= 130 && r >= b + 12 && g >= b) return true;
  if (r >= 155 && g >= 120 && b <= 145 && r >= b + 25) return true;
  if (r >= 200 && g >= 175 && b <= 110) return true;

  // Maillot blanc / gris clair texturé (Italie, etc.)
  if (min >= 170 && max <= 238 && sat >= 2 && sat < 40) return true;
  if (min >= 198 && max >= 228 && sat >= 6 && sat < 26) return true;

  // Mint / teal / bleu-vert clair (Portugal extérieur, etc.)
  if (g >= 90 && g >= r + 5 && b >= 70 && b >= r - 25) return true;
  if (b >= 105 && g >= 95 && r <= 200 && b >= r - 15) return true;
  if (g >= 130 && b >= 120 && r <= 160 && g > r + 8) return true;

  return sat >= 42;
}

/** Bandes jaunes/or (Adidas, badges). */
export function isAccentStripePixel(r: number, g: number, b: number): boolean {
  if (g >= 130 && r >= 85 && b <= 165 && g >= b + 12 && r >= b + 8) return true;
  if (g >= 165 && r >= 140 && b < 145 && g > b + 18) return true;
  if (r >= 200 && g >= 175 && b <= 120 && r - b > 60) return true;
  return false;
}

export function floodFillBackground(
  mask: Uint8Array,
  data: Uint8Array,
  width: number,
  height: number,
  refs: Rgb[],
  tolerance: number,
): void {
  floodFillBackgroundFromBorder(mask, data, width, height, refs, tolerance);
  floodFillEnclosedBackground(mask, data, width, height, refs, tolerance);
}

function floodFillBackgroundFromBorder(
  mask: Uint8Array,
  data: Uint8Array,
  width: number,
  height: number,
  refs: Rgb[],
  tolerance: number,
): void {
  const queue: number[] = [];
  const idx = (x: number, y: number) => y * width + x;

  const tryPush = (x: number, y: number) => {
    const p = idx(x, y);
    if (mask[p]) return;
    const i = p * 4;
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    const a = data[i + 3] ?? 0;
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
    const p = queue.pop()!;
    const x = p % width;
    const y = (p - x) / width;
    if (x > 0) tryPush(x - 1, y);
    if (x < width - 1) tryPush(x + 1, y);
    if (y > 0) tryPush(x, y - 1);
    if (y < height - 1) tryPush(x, y + 1);
  }
}

/** Retire le fond blanc/gris enfermé dans le maillot (col, entre les manches…). */
function floodFillEnclosedBackground(
  mask: Uint8Array,
  data: Uint8Array,
  width: number,
  height: number,
  refs: Rgb[],
  tolerance: number,
): void {
  const visited = new Uint8Array(width * height);
  const idx = (x: number, y: number) => y * width + x;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = idx(x, y);
      if (mask[p] || visited[p]) continue;

      const i = p * 4;
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      if (!matchesBackground(r, g, b, refs, tolerance)) continue;

      const queue = [p];
      const component: number[] = [];
      let touchesBorder = false;
      visited[p] = 1;

      while (queue.length) {
        const cp = queue.pop()!;
        component.push(cp);
        const cx = cp % width;
        const cy = (cp - cx) / width;
        if (cx === 0 || cy === 0 || cx === width - 1 || cy === height - 1) {
          touchesBorder = true;
        }

        const neighbors = [
          [cx - 1, cy],
          [cx + 1, cy],
          [cx, cy - 1],
          [cx, cy + 1],
        ];
        for (const [nx, ny] of neighbors) {
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const np = idx(nx, ny);
          if (mask[np] || visited[np]) continue;
          const ni = np * 4;
          const nr = data[ni] ?? 0;
          const ng = data[ni + 1] ?? 0;
          const nb = data[ni + 2] ?? 0;
          if (!matchesBackground(nr, ng, nb, refs, tolerance)) continue;
          visited[np] = 1;
          queue.push(np);
        }
      }

      if (!touchesBorder) {
        for (const cp of component) mask[cp] = 1;
      }
    }
  }
}

/**
 * Supprime les petits logos / textes de site isolés dans les coins
 * (filigrane boutique en haut à gauche, etc.).
 */
export function removeCornerWatermarkArtifacts(
  data: Uint8Array,
  width: number,
  height: number,
): void {
  const refs = detectBackgroundRefs(data, width, height);
  const labels = new Int32Array(width * height);
  const total = width * height;
  const minKeepArea = total * 0.03;
  const cx0 = Math.floor(width * 0.2);
  const cx1 = Math.ceil(width * 0.8);
  const cy0 = Math.floor(height * 0.1);
  const cy1 = Math.ceil(height * 0.9);

  let nextLabel = 1;
  const stats = new Map<number, { size: number; touchesCenter: boolean }>();

  const isFg = (p: number) => {
    const i = p * 4;
    const a = data[i + 3] ?? 0;
    if (a < 20) return false;
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    if (isStudioBackgroundPixel(r, g, b)) return false;
    return !matchesBackground(r, g, b, refs, 36);
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (!isFg(p) || labels[p] !== 0) continue;

      const label = nextLabel++;
      const queue = [p];
      labels[p] = label;
      let size = 0;
      let touchesCenter = false;

      while (queue.length) {
        const cp = queue.pop()!;
        size++;
        const cx = cp % width;
        const cy = (cp - cx) / width;
        if (cx >= cx0 && cx <= cx1 && cy >= cy0 && cy <= cy1) touchesCenter = true;

        const neighbors = [
          [cx - 1, cy],
          [cx + 1, cy],
          [cx, cy - 1],
          [cx, cy + 1],
        ];
        for (const [nx, ny] of neighbors) {
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const np = ny * width + nx;
          if (labels[np] !== 0 || !isFg(np)) continue;
          labels[np] = label;
          queue.push(np);
        }
      }

      stats.set(label, { size, touchesCenter });
    }
  }

  let largestLabel = 0;
  let largestSize = 0;
  for (const [label, s] of stats) {
    if (s.size > largestSize) {
      largestSize = s.size;
      largestLabel = label;
    }
  }

  for (let p = 0; p < total; p++) {
    const label = labels[p];
    if (label <= 0) continue;
    const s = stats.get(label);
    if (!s) continue;
    const keep =
      label === largestLabel ||
      s.touchesCenter ||
      s.size >= minKeepArea;
    if (keep) continue;
    const i = p * 4;
    data[i] = 255;
    data[i + 1] = 255;
    data[i + 2] = 255;
    data[i + 3] = 255;
  }
}

export function featherEdges(
  data: Uint8Array,
  width: number,
  height: number,
  mask: Uint8Array,
  refs: Rgb[],
  hardTol: number,
  softTol: number,
): void {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (mask[p]) continue;
      const i = p * 4;
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;

      if (isJerseyFabricPixel(r, g, b)) continue;

      let minDist = Infinity;
      for (const [br, bg, bb] of refs) {
        minDist = Math.min(minDist, colorDistance(r, g, b, br, bg, bb));
      }

      if (minDist <= hardTol) {
        data[i + 3] = 0;
      } else if (minDist <= softTol) {
        const t = (minDist - hardTol) / (softTol - hardTol);
        data[i + 3] = Math.round(Math.min(255, (data[i + 3] ?? 0) * t));
      }
    }
  }
}

export interface PixelBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function getAlphaBounds(
  data: Uint8Array,
  width: number,
  height: number,
  alphaThreshold = 14,
): PixelBounds | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3]! > alphaThreshold) {
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

export function getContentBounds(
  data: Uint8Array,
  width: number,
  height: number,
  alphaThreshold = 14,
  whiteThreshold = 246,
): PixelBounds | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      const a = data[i + 3] ?? 0;
      const isBackground =
        a < alphaThreshold ||
        isStudioBackgroundPixel(r, g, b) ||
        (r >= whiteThreshold &&
          g >= whiteThreshold &&
          b >= whiteThreshold &&
          !isJerseyFabricPixel(r, g, b)) ||
        isWarmBackgroundPixel(r, g, b);
      if (!isBackground) {
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

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

/** Lisse l'alpha sur les bords pour un anti-aliasing plus doux. */
export function smoothAlphaEdges(
  data: Uint8Array,
  width: number,
  height: number,
  radius = 2,
): void {
  const alpha = new Float32Array(width * height);
  for (let p = 0; p < width * height; p++) {
    alpha[p] = (data[p * 4 + 3] ?? 0) / 255;
  }

  const smoothed = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            sum += alpha[ny * width + nx] ?? 0;
            count++;
          }
        }
      }
      smoothed[y * width + x] = sum / count;
    }
  }

  for (let p = 0; p < width * height; p++) {
    const a = alpha[p] ?? 0;
    if (a > 0.06 && a < 0.94) {
      data[p * 4 + 3] = clampByte((smoothed[p] ?? a) * 255);
    }
  }
}

/** Corrige les franges blanches/grises des JPEG sur fond clair. */
export function defringeAgainstBackground(
  data: Uint8Array,
  width: number,
  height: number,
  bgR: number,
  bgG: number,
  bgB: number,
  opts?: { protectSaturated?: boolean },
): void {
  const protectSaturated = opts?.protectSaturated ?? false;

  for (let p = 0; p < width * height; p++) {
    const i = p * 4;
    const a = (data[i + 3] ?? 0) / 255;
    if (a <= 0.04 || a >= 0.96) continue;

    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;

    if (protectSaturated && isProtectedJerseyPixel(r, g, b)) continue;

    const invA = 1 / a;

    data[i] = clampByte((r - (1 - a) * bgR) * invA);
    data[i + 1] = clampByte((g - (1 - a) * bgG) * invA);
    data[i + 2] = clampByte((b - (1 - a) * bgB) * invA);
  }
}

/** Rouge / couleurs vives du tissu — ne pas dé-saturer via defringe ou nettoyage de fond. */
export function isProtectedJerseyPixel(r: number, g: number, b: number): boolean {
  return isJerseyFabricPixel(r, g, b);
}

/** Renforce l'opacité des pixels colorés du maillot (intérieur + bords saturés uniquement). */
export function solidifyJerseyColors(
  data: Uint8Array,
  width: number,
  height: number,
): void {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      const i = p * 4;
      const a = data[i + 3] ?? 0;
      if (a === 0) continue;

      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      if (!isJerseyFabricPixel(r, g, b)) continue;

      const onOutline = touchesTransparentNeighbor(data, width, height, x, y);

      if (!onOutline) {
        data[i + 3] = 255;
      }
    }
  }
}

function touchesTransparentNeighbor(
  data: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
): boolean {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) return true;
      const ni = (ny * width + nx) * 4;
      if ((data[ni + 3] ?? 0) < 20) return true;
    }
  }
  return false;
}

function isNeutralOutlinePixel(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min > 34) return false;
  return r >= 205 && g >= 205 && b >= 198;
}

/**
 * Supprime la couronne de pixels (blancs, gris ou couleur du maillot) sur le contour.
 */
export function pruneOutlineHalos(
  data: Uint8Array,
  width: number,
  height: number,
): void {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      const i = p * 4;
      const a = data[i + 3] ?? 0;
      if (a === 0) continue;
      if (!touchesTransparentNeighbor(data, width, height, x, y)) continue;

      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      const sat = Math.max(r, g, b) - Math.min(r, g, b);

      if (isAccentStripePixel(r, g, b)) continue;

      const neutralHalo = isNeutralOutlinePixel(r, g, b);
      const paleFringe =
        !isJerseyFabricPixel(r, g, b) &&
        (neutralHalo || (a < 220 && r >= 200 && g >= 200 && b >= 195));
      const washedFabricFringe =
        isJerseyFabricPixel(r, g, b) &&
        !isAccentStripePixel(r, g, b) &&
        sat < 10 &&
        a < 180 &&
        r >= 248 &&
        g >= 248 &&
        b >= 248;
      const weakColoredFringe =
        isJerseyFabricPixel(r, g, b) &&
        !isAccentStripePixel(r, g, b) &&
        a < 160 &&
        touchesTransparentNeighbor(data, width, height, x, y);

      if (paleFringe || washedFabricFringe || weakColoredFringe) {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 0;
      }
    }
  }
}

/**
 * Mode maillot : alpha strictement 0 ou 255 — pas d'anti-aliasing.
 */
export function binarySilhouetteAlpha(
  data: Uint8Array,
  width: number,
  height: number,
  threshold = 140,
): void {
  for (let p = 0; p < width * height; p++) {
    const i = p * 4;
    const a = data[i + 3] ?? 0;
    if (a >= threshold) {
      data[i + 3] = 255;
      continue;
    }
    data[i] = 0;
    data[i + 1] = 0;
    data[i + 2] = 0;
    data[i + 3] = 0;
  }
}

/** Retire uniquement la frange blanche/grise neutre sur le contour (pas le tissu coloré). */
export function stripNeutralOutlineFringe(
  data: Uint8Array,
  width: number,
  height: number,
): void {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      const i = p * 4;
      const a = data[i + 3] ?? 0;
      if (a === 0) continue;
      if (!touchesTransparentNeighbor(data, width, height, x, y)) continue;

      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;

      if (isAccentStripePixel(r, g, b) || isJerseyFabricPixel(r, g, b)) continue;

      const nearWhite = r >= 238 && g >= 238 && b >= 234;
      if (isNeutralOutlinePixel(r, g, b) || nearWhite) {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 0;
      }
    }
  }
}

/**
 * Finition contour : nettoie la frange parasite, intérieur opaque. Pas de flou global.
 */
export function finalizeSilhouetteAlpha(
  data: Uint8Array,
  width: number,
  height: number,
): void {
  pruneOutlineHalos(data, width, height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = data[i + 3] ?? 0;
      if (a === 0) continue;
      if (!touchesTransparentNeighbor(data, width, height, x, y)) {
        data[i + 3] = 255;
      }
    }
  }
}

/** @deprecated */
export function crispSilhouetteAlpha(
  data: Uint8Array,
  width: number,
  height: number,
): void {
  finalizeSilhouetteAlpha(data, width, height);
}

export function isWarmBackgroundPixel(r: number, g: number, b: number): boolean {
  return r > 195 && g > 175 && b < 165 && r - b > 35 && g - b > 25;
}

/**
 * Corrige le jaune/or écrêté en blanc par le resize (ringing sur bords nets).
 */
export function repairAccentHighlights(
  data: Uint8Array,
  width: number,
  height: number,
): void {
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const p = y * width + x;
      const i = p * 4;
      const a = data[i + 3] ?? 0;
      if (a < 100) continue;

      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;

      const blownHighlight = r >= 236 && g >= 228 && b >= 200;
      if (!blownHighlight) continue;

      let accentNeighbors = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const ni = ((y + dy) * width + (x + dx)) * 4;
          const nr = data[ni] ?? 0;
          const ng = data[ni + 1] ?? 0;
          const nb = data[ni + 2] ?? 0;
          if (isAccentStripePixel(nr, ng, nb)) accentNeighbors++;
        }
      }

      if (accentNeighbors >= 2) {
        data[i] = 222;
        data[i + 1] = 178;
        data[i + 2] = 28;
      }
    }
  }
}

/** Supprime franges jaunes/blanches semi-transparentes (artefacts JPEG + halo). */
export function cleanColorFringe(
  data: Uint8Array,
  width: number,
  height: number,
): void {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      const a = data[i + 3] ?? 0;

      if (a === 0) continue;

      if (isJerseyFabricPixel(r, g, b) || isAccentStripePixel(r, g, b)) continue;

      const nearWhite = r >= 240 && g >= 240 && b >= 240;
      const yellowFringe = a < 220 && isWarmBackgroundPixel(r, g, b);
      const paleEdge =
        a < 140 &&
        nearWhite &&
        y >= Math.floor(height * 0.82) &&
        touchesTransparentNeighbor(data, width, height, x, y);
      const blockyWarm =
        y >= Math.floor(height * 0.75) &&
        a < 120 &&
        isWarmBackgroundPixel(r, g, b);

      if (yellowFringe || paleEdge || blockyWarm) {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 0;
        continue;
      }

      if (a < 255 && a > 8 && isWarmBackgroundPixel(r, g, b)) {
        data[i + 3] = 0;
      }
    }
  }
}

/** Nettoie la bande basse où la frange jaune apparaît le plus souvent. */
export function cleanBottomEdgeBand(
  data: Uint8Array,
  width: number,
  height: number,
): void {
  const startY = Math.floor(height * 0.88);
  for (let y = startY; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = data[i + 3] ?? 0;
      if (a === 0) continue;
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      if (a < 220 || isWarmBackgroundPixel(r, g, b)) {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 0;
      }
    }
  }
}

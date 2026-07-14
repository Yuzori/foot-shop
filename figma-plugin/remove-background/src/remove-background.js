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

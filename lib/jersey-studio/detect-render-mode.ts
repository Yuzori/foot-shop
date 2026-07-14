import type { JerseyRenderMode } from "@/lib/jersey-studio/render-mode";



const BG_THRESHOLD = 238;

const EDGE_BAND_RATIO = 0.03;

const EDGE_MARGIN_RATIO = 0.02;



function isBackgroundPixel(

  data: Uint8Array | Uint8ClampedArray,

  idx: number,

  channels: number,

): boolean {

  const r = data[idx] ?? 0;

  const g = data[idx + 1] ?? 0;

  const b = data[idx + 2] ?? 0;

  const max = Math.max(r, g, b);

  const min = Math.min(r, g, b);



  if (r >= BG_THRESHOLD && g >= BG_THRESHOLD && b >= BG_THRESHOLD) return true;

  if (max - min < 14 && max >= 218) return true;

  return false;

}



/**

 * Détecte le mode de rendu à partir des pixels source.

 * - Détail / zoom : sujet carré, touche les bords, ou remplit presque tout le cadre.

 * - Maillot : silhouette verticale avec marges.

 */

export function detectRenderModeFromRgba(

  data: Uint8Array | Uint8ClampedArray,

  width: number,

  height: number,

  channels = 4,

): JerseyRenderMode {

  if (width < 2 || height < 2) return "uniform";



  const minDim = Math.min(width, height);

  const band = Math.max(2, Math.round(minDim * EDGE_BAND_RATIO));

  const margin = Math.max(1, Math.round(minDim * EDGE_MARGIN_RATIO));

  const aspect = width / height;



  const isContent = (x: number, y: number) => {

    const idx = (y * width + x) * channels;

    return !isBackgroundPixel(data, idx, channels);

  };



  let edgeTotal = 0;

  let edgeContent = 0;



  for (let y = 0; y < height; y++) {

    for (let x = 0; x < width; x++) {

      const onEdge = x < band || x >= width - band || y < band || y >= height - band;

      if (!onEdge) continue;

      edgeTotal++;

      if (isContent(x, y)) edgeContent++;

    }

  }



  const edgeRatio = edgeTotal > 0 ? edgeContent / edgeTotal : 0;



  let minX = width;

  let minY = height;

  let maxX = 0;

  let maxY = 0;

  let hasContent = false;



  for (let y = 0; y < height; y++) {

    for (let x = 0; x < width; x++) {

      if (!isContent(x, y)) continue;

      hasContent = true;

      if (x < minX) minX = x;

      if (y < minY) minY = y;

      if (x > maxX) maxX = x;

      if (y > maxY) maxY = y;

    }

  }



  if (!hasContent) return "uniform";



  const touchesEdge =

    minX <= margin ||

    minY <= margin ||

    maxX >= width - 1 - margin ||

    maxY >= height - 1 - margin;



  const fillX = (maxX - minX + 1) / width;

  const fillY = (maxY - minY + 1) / height;

  const fillArea = fillX * fillY;

  const contentAspect = (maxX - minX + 1) / Math.max(1, maxY - minY + 1);

  const isSquareish = aspect >= 0.82 && aspect <= 1.22;

  const contentSquareish = contentAspect >= 0.75 && contentAspect <= 1.35;

  const isTallJersey = aspect < 0.78 || (fillY > fillX + 0.12 && fillY >= 0.55);



  if (edgeRatio >= 0.13) return "detail";

  if (touchesEdge && fillX >= 0.8 && fillY >= 0.8) return "detail";

  if (fillX >= 0.9 && fillY >= 0.9) return "detail";



  // Zoom détail : image carrée, sujet centré qui ne touche pas les bords (badge, tissu…)

  if (isSquareish && contentSquareish && fillArea >= 0.28 && fillArea <= 0.88 && !isTallJersey) {

    return "detail";

  }



  // Grand carré produit sans marges blanches larges

  if (isSquareish && fillArea >= 0.42 && !touchesEdge && !isTallJersey) {

    return "detail";

  }



  return "uniform";

}



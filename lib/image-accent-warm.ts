import { serverConfig } from "@/config";
import type { ImageAccentData } from "@/lib/image-accent-core";
import { readAccentCache } from "@/lib/image-accent-cache";
import { processImageToWebp } from "@/lib/image-proxy-process";

/** Lit le cache ou récupère l'image PrestaShop pour calculer l'accent. */
export async function warmProductAccent(
  productId: string,
  imageId: string,
): Promise<ImageAccentData | null> {
  const cached = await readAccentCache(productId, imageId);
  if (cached) return cached;

  if (!serverConfig.isConfigured) return null;

  const base = serverConfig.apiUrl.replace(/\/$/, "");
  const url = `${base}/images/products/${productId}/${imageId}`;
  const auth = Buffer.from(`${serverConfig.apiKey}:`).toString("base64");

  try {
    const upstream = await fetch(url, {
      headers: { Authorization: `Basic ${auth}` },
      next: { revalidate: 86400 },
    });
    if (!upstream.ok) return null;

    const input = Buffer.from(await upstream.arrayBuffer());
    const { accent } = await processImageToWebp(input, { productId, imageId });
    return accent;
  } catch {
    return null;
  }
}

/** Limite la concurrence pour ne pas saturer PrestaShop. */
export async function warmProductAccentsPool(
  items: Array<{ productId: string; imageId: string }>,
  concurrency = 6,
): Promise<Map<string, ImageAccentData>> {
  const out = new Map<string, ImageAccentData>();
  if (items.length === 0) return out;

  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index++;
      const item = items[current];
      if (!item) continue;
      const accent = await warmProductAccent(item.productId, item.imageId);
      if (accent) out.set(`${item.productId}-${item.imageId}`, accent);
    }
  }

  const workers = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return out;
}

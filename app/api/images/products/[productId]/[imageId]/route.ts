import { serverConfig } from "@/config";
import { processImageToWebp } from "@/lib/image-proxy-process";

/**
 * Image proxy — fetch PrestaShop, convert to WebP, cache accent color.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ productId: string; imageId: string }> },
) {
  const { productId, imageId } = await params;

  if (!/^\d+$/.test(productId) || !/^\d+$/.test(imageId)) {
    return new Response(null, { status: 400 });
  }

  if (!serverConfig.isConfigured) {
    return new Response(null, { status: 404 });
  }

  const base = serverConfig.apiUrl.replace(/\/$/, "");
  const url = `${base}/images/products/${productId}/${imageId}`;
  const auth = Buffer.from(`${serverConfig.apiKey}:`).toString("base64");

  try {
    const upstream = await fetch(url, {
      headers: { Authorization: `Basic ${auth}` },
      next: { revalidate: 86400 },
    });

    if (!upstream.ok) {
      return new Response(null, { status: upstream.status || 502 });
    }

    const input = Buffer.from(await upstream.arrayBuffer());
    const { body } = await processImageToWebp(input, { productId, imageId });

    return new Response(new Uint8Array(body), {
      status: 200,
      headers: {
        "Content-Type": "image/webp",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control":
          "public, max-age=604800, s-maxage=604800, stale-while-revalidate=86400, immutable",
        Vary: "Accept",
      },
    });
  } catch {
    return new Response(null, { status: 502 });
  }
}

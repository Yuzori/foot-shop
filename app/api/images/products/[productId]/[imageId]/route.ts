import { serverConfig } from "@/config";

/**
 * Image proxy.
 *
 * PrestaShop Webservice image URLs require HTTP Basic Auth (the secret key),
 * which the browser cannot send. We fetch the image server-side WITH the key
 * and stream it back same-origin, so <Image> just works and the key stays
 * secret. This keeps the front fully decoupled (no PrestaShop host exposed).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ productId: string; imageId: string }> },
) {
  const { productId, imageId } = await params;

  // Only allow numeric ids (prevents SSRF / path traversal).
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
      // Cache at the fetch layer too.
      next: { revalidate: 86400 },
    });

    if (!upstream.ok || !upstream.body) {
      return new Response(null, { status: upstream.status || 502 });
    }

    const contentType = upstream.headers.get("content-type") ?? "image/jpeg";

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=86400, immutable",
      },
    });
  } catch {
    return new Response(null, { status: 502 });
  }
}

import { serverConfig } from "@/config";

/**
 * Category image proxy.
 *
 * PrestaShop serves category images at `/api/images/categories/{id}` behind
 * HTTP Basic Auth (the secret key). The browser can't send that, so we fetch it
 * server-side and stream it back same-origin. Missing images return 404, which
 * makes <ProductImage> fall back to the neutral placeholder.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!/^\d+$/.test(id)) {
    return new Response(null, { status: 400 });
  }

  if (!serverConfig.isConfigured) {
    return new Response(null, { status: 404 });
  }

  const base = serverConfig.apiUrl.replace(/\/$/, "");
  const url = `${base}/images/categories/${id}`;
  const auth = Buffer.from(`${serverConfig.apiKey}:`).toString("base64");

  try {
    const upstream = await fetch(url, {
      headers: { Authorization: `Basic ${auth}` },
      next: { revalidate: 86400 },
    });

    if (!upstream.ok || !upstream.body) {
      if (process.env.NODE_ENV !== "production") {
        console.info(`[img] category ${id} upstream ${upstream.status} (${url})`);
      }
      return new Response(null, { status: upstream.status || 404 });
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

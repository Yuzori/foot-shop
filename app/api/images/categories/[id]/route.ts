import { serverConfig } from "@/config";
import { processImageToWebp } from "@/lib/image-proxy-process";

/** Category image proxy — WebP optimisé. */
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

    if (!upstream.ok) {
      return new Response(null, { status: upstream.status || 404 });
    }

    const input = Buffer.from(await upstream.arrayBuffer());
    const { body } = await processImageToWebp(input);

    return new Response(new Uint8Array(body), {
      status: 200,
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control":
          "public, max-age=604800, s-maxage=604800, stale-while-revalidate=86400, immutable",
      },
    });
  } catch {
    return new Response(null, { status: 502 });
  }
}

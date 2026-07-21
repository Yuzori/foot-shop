import "server-only";

import { serverConfig } from "@/config";
import { siteUrlPath } from "@/lib/site-url";

function resolvePrestaShopPublicOrigin(): string | null {
  const explicit = process.env.PRESTASHOP_PUBLIC_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }

  const host = process.env.PRESTASHOP_IMAGE_HOSTS?.split(",")
    .map((value) => value.trim())
    .find(Boolean);
  if (host) {
    return host.startsWith("http") ? host.replace(/\/$/, "") : `https://${host}`;
  }

  if (!serverConfig.apiUrl) return null;
  try {
    const parsed = new URL(serverConfig.apiUrl);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

/** URL publique PrestaShop (/img/p/…) — fiable dans les clients mail. */
export function prestashopPublicImageUrl(
  imageId: string,
  size: "large_default" | "home_default" = "large_default",
): string | null {
  const id = String(imageId).replace(/\D/g, "");
  if (!id) return null;

  const origin = resolvePrestaShopPublicOrigin();
  if (!origin) return null;

  const folder = id.split("").join("/");
  return `${origin}/img/p/${folder}/${id}-${size}.jpg`;
}

type CoverLike = { id: string; url: string };

/** Image produit pour email : PrestaShop public en priorité, proxy site en secours. */
export function productCoverEmailImageUrl(product: {
  id: string;
  cover?: CoverLike | null;
  images?: CoverLike[];
}): string {
  const cover = product.cover ?? product.images?.[0];
  if (!cover) return "";

  const publicUrl = prestashopPublicImageUrl(cover.id);
  if (publicUrl) return publicUrl;

  return siteUrlPath(cover.url);
}

/** Résout une URL relative ou un couple productId/imageId pour les emails. */
export function resolveEmailProductImageUrl(input: {
  productId?: string;
  imageId?: string | null;
  relativeUrl?: string | null;
}): string {
  if (input.imageId) {
    const publicUrl = prestashopPublicImageUrl(input.imageId);
    if (publicUrl) return publicUrl;
  }

  if (input.relativeUrl) {
    return siteUrlPath(input.relativeUrl);
  }

  return "";
}

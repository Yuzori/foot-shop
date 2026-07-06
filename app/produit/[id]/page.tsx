import { type Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductDetail } from "@/components/product/product-detail";
import { publicConfig } from "@/config";
import { routes } from "@/config/site";
import { stripHtml, truncate } from "@/lib/utils";
import { prestashop } from "@/services/prestashop";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const product = await prestashop.getProductById(id);
  if (!product) return { title: "Produit introuvable" };

  const description = truncate(
    stripHtml(product.summary || product.description) ||
      `Découvrez ${product.name}.`,
    160,
  );

  return {
    title: product.name,
    description,
    openGraph: {
      title: product.name,
      description,
      images: product.cover ? [{ url: product.cover.url }] : undefined,
    },
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { id } = await params;
  const product = await prestashop.getProductById(id);

  // When the back office is connected but the product doesn't exist -> 404.
  // When the back office is NOT configured, `isConfigured` is false and we
  // still render a graceful "introuvable" state via notFound().
  if (!product) notFound();

  const base = publicConfig.siteUrl.replace(/\/$/, "");
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description:
      stripHtml(product.summary || product.description) || product.name,
    image: product.cover ? [`${base}${product.cover.url}`] : undefined,
    sku: product.id,
    offers: {
      "@type": "Offer",
      priceCurrency: product.currency,
      price: product.price,
      availability: product.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      url: `${base}${routes.product(product.id)}`,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ProductDetail product={product} />
    </>
  );
}

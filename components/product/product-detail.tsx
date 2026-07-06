"use client";

import Link from "next/link";
import { useEffect } from "react";

import { SectionHeader } from "@/components/common/section-header";
import { FavoriteButton } from "@/components/product/favorite-button";
import { ProductEngagementTracker } from "@/components/product/product-engagement-tracker";
import { ProductGallery } from "@/components/product/product-gallery";
import { ProductGrid } from "@/components/product/product-grid";
import { ProductDescriptionBlock } from "@/components/product/product-description-block";
import { ProductBadges } from "@/components/product/product-badges";
import { ProductPurchase } from "@/components/product/product-purchase";
import { StockAlertBell } from "@/components/product/stock-alert-bell";
import { Container } from "@/components/ui/container";
import { routes } from "@/config/site";
import { useProducts } from "@/hooks/use-products";
import { stripHtml } from "@/lib/utils";
import { useRecentProductStore } from "@/store/recent-product-store";
import type { Product } from "@/types/domain";

interface ProductDetailProps {
  product: Product;
}

export function ProductDetail({ product }: ProductDetailProps) {
  const setRecent = useRecentProductStore((s) => s.setRecent);
  const related = useProducts(
    product.defaultCategoryId
      ? { category: product.defaultCategoryId, limit: 4 }
      : { sort: "newest", limit: 4 },
  );

  const relatedProducts = (related.data?.items ?? []).filter(
    (p) => p.id !== product.id,
  );

  useEffect(() => {
    setRecent({
      id: product.id,
      name: product.name,
      image: product.cover?.url ?? null,
      price: product.price,
      currency: product.currency,
      inStock: product.inStock,
    });
  }, [product, setRecent]);

  return (
    <>
      <ProductEngagementTracker productId={product.id} />

      <Container className="py-8 lg:py-12">
        <nav className="mb-8 flex items-center gap-2 text-xs text-ink/40">
          <Link href={routes.home} className="hover:text-ink">Accueil</Link>
          <span>/</span>
          <Link href={routes.catalogue} className="hover:text-ink">Boutique</Link>
          <span>/</span>
          <span className="truncate text-ink/60">{product.name}</span>
        </nav>

        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <ProductGallery images={product.images} name={product.name} />
            <ProductDescriptionBlock
              summary={stripHtml(product.summary)}
              descriptionHtml={product.description}
            />
          </div>

          <div className="flex flex-col lg:sticky lg:top-28 lg:self-start">
            <div className="flex items-start justify-between gap-4">
              <div>
                <ProductBadges
                  product={product}
                  showLowStock={false}
                  className="mb-3 flex flex-wrap gap-2"
                />
                <h1 className="display-2 text-3xl sm:text-4xl">{product.name}</h1>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {!product.inStock ? (
                  <StockAlertBell
                    productId={product.id}
                    productName={product.name}
                  />
                ) : null}
                <FavoriteButton productId={product.id} />
              </div>
            </div>

            <div className="mt-8">
              <ProductPurchase product={product} />
            </div>
          </div>
        </div>
      </Container>

      {relatedProducts.length > 0 ? (
        <Container className="py-20">
          <SectionHeader title="Vous aimerez aussi" className="mb-12" />
          <ProductGrid products={relatedProducts.slice(0, 4)} />
        </Container>
      ) : null}
    </>
  );
}

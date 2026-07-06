import { Badge } from "@/components/ui/badge";
import { shopConfig } from "@/config/shop";
import { isLowStock, totalVariantStock } from "@/lib/stock-display";
import type { Product } from "@/types/domain";

interface ProductBadgesProps {
  product: Product;
  className?: string;
  /** Masquer « Bientôt épuisé » (ex. fiche produit où le stock est déjà affiché). */
  showLowStock?: boolean;
}

/** Badges produit — nouveau (configurable), promo, bientôt épuisé, rupture. */
export function ProductBadges({
  product,
  className,
  showLowStock = true,
}: ProductBadgesProps) {
  const totalStock = totalVariantStock(product);
  const lowStock = showLowStock && isLowStock(totalStock);

  return (
    <div className={className}>
      {shopConfig.showNewBadge && product.isNew ? (
        <Badge tone="dark">Nouveau</Badge>
      ) : null}
      {product.isOnSale ? <Badge tone="accent">Promo</Badge> : null}
      {lowStock ? (
        <Badge tone="accent">Bientôt épuisé ({totalStock})</Badge>
      ) : null}
      {!product.inStock ? <Badge tone="muted">Épuisé</Badge> : null}
    </div>
  );
}

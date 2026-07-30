import "server-only";

import { shopConfig } from "@/config/shop";
import { countPaidOrdersForCheckout } from "@/lib/customer-order-history";
import { prestashop } from "@/services/prestashop";

export interface ShippingFeeResult {
  fee: number;
  free: boolean;
  label: string;
  /** Nombre de tranches facturées (hors 1ʳᵉ commande offerte). */
  units?: number;
}

/** Calcule les frais : 3,99 € par tranche de N articles (arrondi supérieur). */
export function calculateShippingFee(itemCount: number): number {
  const qty = Math.max(0, Math.floor(itemCount));
  if (qty <= 0) return 0;
  const perItems = shopConfig.shippingItemsPerUnit;
  const units = Math.ceil(qty / perItems);
  return Math.round(units * shopConfig.standardShippingPrice * 100) / 100;
}

function paidShippingLabel(fee: number, units: number): string {
  const feeLabel = fee.toFixed(2).replace(".", ",");
  const unitPrice = shopConfig.standardShippingPrice
    .toFixed(2)
    .replace(".", ",");
  if (units <= 1) {
    return `${shopConfig.paidShippingLabel} — ${feeLabel} €`;
  }
  return `${shopConfig.paidShippingLabel} — ${feeLabel} € (${units} × ${unitPrice} € / ${shopConfig.shippingItemsPerUnit} art.)`;
}

/** Livraison offerte si le client n'a encore aucune commande payée. */
export async function resolveShippingFee(input: {
  email: string;
  customerId?: string | null;
  /** Quantité totale d'articles dans le panier. */
  itemCount?: number;
}): Promise<ShippingFeeResult> {
  const itemCount = Math.max(0, Math.floor(input.itemCount ?? 1));
  const units = Math.max(1, Math.ceil(itemCount / shopConfig.shippingItemsPerUnit));
  const standard = calculateShippingFee(Math.max(1, itemCount));
  const paidLabel = paidShippingLabel(standard, units);

  if (!prestashop.isConfigured) {
    return { fee: standard, free: false, label: paidLabel, units };
  }

  let customerId = input.customerId?.trim() || "";
  if (!customerId && input.email.trim()) {
    const existing = await prestashop.getCustomerAuthByEmail(input.email.trim());
    customerId = existing?.id ?? "";
  }

  if (!customerId) {
    return {
      fee: 0,
      free: true,
      label: shopConfig.freeShippingLabel,
      units: 0,
    };
  }

  const paidOrders = await countPaidOrdersForCheckout({
    email: input.email,
    customerId,
  });
  if (paidOrders === 0) {
    return {
      fee: 0,
      free: true,
      label: shopConfig.freeShippingLabel,
      units: 0,
    };
  }

  return { fee: standard, free: false, label: paidLabel, units };
}

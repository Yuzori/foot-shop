import "server-only";

import { shopConfig } from "@/config/shop";
import { countPaidOrdersForCheckout } from "@/lib/customer-order-history";
import { prestashop } from "@/services/prestashop";

export interface ShippingFeeResult {
  fee: number;
  free: boolean;
  label: string;
}

/** Livraison offerte si le client n'a encore aucune commande payée. */
export async function resolveShippingFee(input: {
  email: string;
  customerId?: string | null;
}): Promise<ShippingFeeResult> {
  const standard = shopConfig.standardShippingPrice;
  const paidLabel = `${shopConfig.paidShippingLabel} — ${standard.toFixed(2).replace(".", ",")} €`;

  if (!prestashop.isConfigured) {
    return { fee: standard, free: false, label: paidLabel };
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
    };
  }

  return { fee: standard, free: false, label: paidLabel };
}

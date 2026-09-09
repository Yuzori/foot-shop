import "server-only";

import { apologyPromo, firstOrderThankYouPromo, flocageTestPromo } from "@/config/promotions";
import { flocagePromoDiscount } from "@/lib/apply-flocage-promo";
import { countPaidOrdersForCheckout } from "@/lib/customer-order-history";
import {
  hasUsedFootshop15Promo,
  isFootshop10RevokedForCustomer,
  isFootshop15GrantedForCustomer,
} from "@/lib/customer-promo-grants-store";
import { hasUsedThankYouPromo } from "@/lib/thank-you-promo-store";
import {
  applyPercentDiscount,
  resolvePromoCode,
  type PromoCodeKind,
  type PromoCodeResult,
} from "@/lib/promo-code";
import type { CreateOrderLine } from "@/services/prestashop";

export interface PromoValidationSuccess extends PromoCodeResult {
  valid: true;
  discount: number;
  kind: PromoCodeKind;
}

export type PromoValidationResult =
  | PromoValidationSuccess
  | { valid: false; message: string };

/** Valide un code promo selon les règles métier (2ᵉ commande, usage unique, etc.). */
export async function validatePromoCodeForCheckout(input: {
  code: string | undefined | null;
  email: string;
  customerId?: string | null;
  subtotal: number;
  lines?: readonly CreateOrderLine[];
}): Promise<PromoValidationResult | null> {
  const resolved = resolvePromoCode(input.code);
  if (!resolved) return null;

  if (!resolved.valid) {
    return { valid: false, message: "Code promo invalide." };
  }

  if (resolved.code === firstOrderThankYouPromo.code) {
    const paidCount = await countPaidOrdersForCheckout({
      email: input.email,
      customerId: input.customerId,
    });

    if (paidCount === 0) {
      return {
        valid: false,
        message: "Ce code est valable à partir de votre 2ᵉ commande.",
      };
    }

    const revoked = await isFootshop10RevokedForCustomer({
      email: input.email,
      customerId: input.customerId,
    });
    if (revoked) {
      return {
        valid: false,
        message: "Ce code n'est plus actif sur votre compte. Utilisez FOOTSHOP15.",
      };
    }

    const alreadyUsed = await hasUsedThankYouPromo({
      email: input.email,
      customerId: input.customerId,
    });
    if (alreadyUsed) {
      return { valid: false, message: "Ce code a déjà été utilisé." };
    }
  }

  if (resolved.code === apologyPromo.code) {
    const granted = await isFootshop15GrantedForCustomer({
      email: input.email,
      customerId: input.customerId,
    });
    if (!granted) {
      return { valid: false, message: "Code promo invalide." };
    }

    const alreadyUsed = await hasUsedFootshop15Promo({
      email: input.email,
      customerId: input.customerId,
    });
    if (alreadyUsed) {
      return { valid: false, message: "Ce code a déjà été utilisé." };
    }
  }

  if (resolved.code === flocageTestPromo.code) {
    const flocageQty =
      input.lines?.filter((line) => line.flocage).reduce((sum, line) => sum + line.quantity, 0) ??
      0;
    if (flocageQty === 0) {
      return {
        valid: false,
        message: "Ce code s'applique aux commandes avec flocage.",
      };
    }

    const discount = flocagePromoDiscount(input.lines ?? [], flocageTestPromo.flocagePrice);
    return {
      ...resolved,
      valid: true,
      discount,
      freeShipping: flocageTestPromo.freeShipping,
    };
  }

  const discount = applyPercentDiscount(input.subtotal, resolved.percent);
  return {
    ...resolved,
    valid: true,
    discount,
  };
}

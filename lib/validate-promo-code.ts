import "server-only";

import { apologyPromo, firstOrderThankYouPromo } from "@/config/promotions";
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
  type PromoCodeResult,
} from "@/lib/promo-code";

export interface PromoValidationSuccess extends PromoCodeResult {
  valid: true;
  discount: number;
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

  const discount = applyPercentDiscount(input.subtotal, resolved.percent);
  return {
    ...resolved,
    valid: true,
    discount,
  };
}

import "server-only";

import { welcomePromo } from "@/config/promotions";
import { countPaidOrdersForCheckout } from "@/lib/customer-order-history";
import type { CheckoutBody } from "@/lib/orders";
import {
  hashWelcomePromoIdentity,
  hashWelcomePromoIp,
} from "@/lib/welcome-promo-fingerprint";
import {
  isWelcomePromoIdentityClaimed,
  isWelcomePromoIpClaimed,
} from "@/lib/welcome-promo-claims-store";

export type WelcomePromoEligibilityResult = {
  eligible: boolean;
  identityHash: string;
  ipHash: string;
  reason?: "disabled" | "already_ordered" | "identity_used" | "ip_used";
};

export async function evaluateWelcomePromoEligibility(input: {
  contact: CheckoutBody["contact"];
  address: CheckoutBody["address"];
  clientIp: string;
  customerId?: string | null;
}): Promise<WelcomePromoEligibilityResult> {
  const identityHash = hashWelcomePromoIdentity(input.contact, input.address);
  const ipHash = hashWelcomePromoIp(input.clientIp);

  if (!welcomePromo.enabled) {
    return { eligible: false, identityHash, ipHash, reason: "disabled" };
  }

  const email = input.contact.email?.trim();
  if (!email) {
    return { eligible: false, identityHash, ipHash, reason: "already_ordered" };
  }

  const paidOrders = await countPaidOrdersForCheckout({
    email,
    customerId: input.customerId ?? undefined,
  });
  if (paidOrders > 0) {
    return { eligible: false, identityHash, ipHash, reason: "already_ordered" };
  }

  if (await isWelcomePromoIdentityClaimed(identityHash)) {
    return { eligible: false, identityHash, ipHash, reason: "identity_used" };
  }

  const ip = input.clientIp.trim();
  if (ip && ip !== "unknown" && await isWelcomePromoIpClaimed(ipHash)) {
    return { eligible: false, identityHash, ipHash, reason: "ip_used" };
  }

  return { eligible: true, identityHash, ipHash };
}

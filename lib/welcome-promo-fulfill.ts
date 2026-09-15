import "server-only";

import { claimWelcomePromoUsage } from "@/lib/welcome-promo-claims-store";
import { markWelcomePromoUsed } from "@/lib/welcome-promo-store";

/** Marque l'offre 2+1 comme utilisée après paiement (empreinte + legacy compte). */
export async function fulfillWelcomePromoFromStripeMetadata(
  metadata: Record<string, string> | null | undefined,
): Promise<void> {
  if (metadata?.welcomePromo !== "1") return;

  const identityHash = metadata.welcomePromoIdentityHash?.trim() ?? "";
  const ipHash = metadata.welcomePromoIpHash?.trim() ?? "";
  if (identityHash || ipHash) {
    await claimWelcomePromoUsage({
      identityHash,
      ipHash,
      reference: metadata.reference?.trim() || undefined,
    });
  }

  const customerId = metadata.customerId?.trim();
  if (customerId) {
    await markWelcomePromoUsed(customerId);
  }
}

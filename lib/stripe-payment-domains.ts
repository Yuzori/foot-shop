import "server-only";

import { publicConfig } from "@/config";
import { getStripe } from "@/lib/stripe-server";

let ensured = false;

function domainsFromSiteUrl(siteUrl: string): string[] {
  try {
    const host = new URL(siteUrl).hostname.toLowerCase();
    if (!host || host === "localhost" || host.endsWith(".local")) {
      return [];
    }
    const domains = new Set<string>([host]);
    if (host.startsWith("www.")) {
      domains.add(host.slice(4));
    } else {
      domains.add(`www.${host}`);
    }
    return [...domains];
  } catch {
    return [];
  }
}

/** Enregistre foot-shop.fr (et www) auprès de Stripe pour Apple Pay / Google Pay. */
export async function ensureStripePaymentMethodDomains(): Promise<void> {
  if (ensured) return;

  const domains = domainsFromSiteUrl(publicConfig.siteUrl);
  if (domains.length === 0) return;

  const stripe = getStripe();

  for (const domain_name of domains) {
    try {
      await stripe.paymentMethodDomains.create({ domain_name });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      if (
        !message.includes("already exists") &&
        !message.includes("already been taken")
      ) {
        console.warn(
          `[stripe] payment_method_domains.create(${domain_name})`,
          message,
        );
      }
    }
  }

  ensured = true;
}

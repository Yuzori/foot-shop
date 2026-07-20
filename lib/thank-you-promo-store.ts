import "server-only";

import { firstOrderThankYouPromo } from "@/config/promotions";
import { listOrderArchives } from "@/lib/order-archive-store";
import { prestashop } from "@/services/prestashop";

const THANK_YOU_CODE = firstOrderThankYouPromo.code.toUpperCase();

async function resolveCustomerId(input: {
  email?: string;
  customerId?: string | null;
}): Promise<string> {
  const direct = input.customerId?.trim() ?? "";
  if (direct) return direct;

  const email = input.email?.trim() ?? "";
  if (!email || !prestashop.isConfigured) return "";

  const customer = await prestashop.getCustomerAuthByEmail(email);
  return customer?.id ?? "";
}

/** Le client a-t-il déjà utilisé le code FOOTSHOP10 sur une commande payée ? */
export async function hasUsedThankYouPromo(input: {
  email?: string;
  customerId?: string | null;
}): Promise<boolean> {
  const customerId = await resolveCustomerId(input);
  const email = input.email?.trim().toLowerCase() ?? "";
  const archives = await listOrderArchives(2000);

  return archives.some((record) => {
    if (record.promoCode?.toUpperCase() !== THANK_YOU_CODE) return false;
    if (record.status !== "paid" && !record.paidAt) return false;

    if (customerId && record.customerId === customerId) return true;
    if (email && record.contact.email.trim().toLowerCase() === email) {
      return true;
    }
    return false;
  });
}

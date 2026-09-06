import "server-only";

import { firstOrderThankYouPromo } from "@/config/promotions";
import { countPaidOrdersByCustomer } from "@/lib/customer-order-history";
import { resolveCheckoutNotificationEmail } from "@/lib/checkout-notification-email";
import type { OrderArchiveRecord } from "@/lib/order-archive-store";
import {
  claimOrderCustomerEmails,
  hasOrderCustomerEmailsBeenSent,
  markOrderCustomerEmailsSent,
  releaseOrderCustomerEmailsClaim,
} from "@/lib/order-customer-email-store";
import { sendOrderConfirmationEmail } from "@/lib/order-confirmation-email";
import { sendShippingPendingEmail } from "@/lib/shipping-pending-email";
import { prestashop } from "@/services/prestashop";
import type { Order } from "@/types/domain";

/** Envoie confirmation + suivi en attente si pas encore fait pour cette commande. */
export async function sendPaidOrderCustomerEmailsIfNeeded(input: {
  order: Order;
  orderId: string;
  archive?: OrderArchiveRecord | null;
  checkoutEmail?: string | null;
  force?: boolean;
}): Promise<boolean> {
  const key = String(input.orderId).trim();
  if (!key) return false;

  if (!input.force && (await hasOrderCustomerEmailsBeenSent(key))) {
    return false;
  }

  if (!input.force && !(await claimOrderCustomerEmails(key))) {
    return false;
  }

  const email = resolveCheckoutNotificationEmail({
    archive: input.archive,
    checkoutEmail: input.checkoutEmail,
    fallbackEmail: await prestashop.getCustomerEmailByOrderId(key),
  });

  if (!email) {
    console.warn("[order-paid] no customer email for order", key);
    if (!input.force) {
      await releaseOrderCustomerEmailsClaim(key).catch(() => {});
    }
    return false;
  }

  const customerId = (await prestashop.getCustomerAuthByEmail(email))?.id ?? null;
  let isFirstPaidOrder = false;
  if (customerId) {
    const paidCount = await countPaidOrdersByCustomer(customerId);
    isFirstPaidOrder = paidCount <= 1;
  } else {
    isFirstPaidOrder = true;
  }

  const firstName = input.archive?.contact.firstName;

  try {
    await Promise.all([
      sendOrderConfirmationEmail({
        to: email,
        order: input.order,
        firstName,
        firstOrderPromo: isFirstPaidOrder
          ? {
              code: firstOrderThankYouPromo.code,
              percent: firstOrderThankYouPromo.percent,
            }
          : undefined,
      }),
      sendShippingPendingEmail({
        to: email,
        reference: input.order.reference,
        firstName,
      }),
    ]);
    await markOrderCustomerEmailsSent(key);
    return true;
  } catch (err) {
    console.error("[order-paid] customer emails failed", key, err);
    if (!input.force) {
      await releaseOrderCustomerEmailsClaim(key).catch(() => {});
    }
    return false;
  }
}

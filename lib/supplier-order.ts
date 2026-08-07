import "server-only";

import { buildBbdBuyOrderDraft } from "@/lib/bbdbuy/build-draft";
import { getOrderArchiveByReference } from "@/lib/order-archive-store";
import { sendBbdBuyOperatorEmail } from "@/lib/supplier-order-email";
import {
  getSupplierOrderDraft,
  saveSupplierOrderDraft,
} from "@/lib/supplier-order-store";
import { prestashop } from "@/services/prestashop";
import type { Order } from "@/types/domain";

/**
 * Prépare et notifie une commande payée pour saisie BBDBuy (agent d'achat —
 * pas d'API publique). Génère un brouillon JSON + email opérateur.
 */
export async function notifySupplierOfOrder(
  order: Order,
  orderId: string,
  options?: { force?: boolean },
): Promise<void> {
  const existing = await getSupplierOrderDraft(order.reference);
  if (existing?.status === "submitted" && !options?.force) return;

  const context = await prestashop.getSupplierOrderContext(orderId);
  if (!context) {
    console.warn("[supplier] context unavailable for order", orderId);
    return;
  }

  const archive = await getOrderArchiveByReference(order.reference);
  if (archive) {
    if (!context.customerEmail && archive.contact.email) {
      context.customerEmail = archive.contact.email;
    }
    const deliveryEmpty =
      !context.delivery.address1?.trim() ||
      !context.delivery.city?.trim();
    if (deliveryEmpty) {
      context.delivery = {
        firstName: archive.contact.firstName || context.delivery.firstName,
        lastName: archive.contact.lastName || context.delivery.lastName,
        phone: archive.contact.phone || context.delivery.phone,
        address1: archive.address.address1,
        address2: archive.address.address2 ?? "",
        postcode: archive.address.postcode,
        city: archive.address.city,
        country: archive.address.country || "France",
      };
    }
  }

  const draft = await buildBbdBuyOrderDraft(context);
  await saveSupplierOrderDraft(draft);

  const missing = draft.lines.filter((l) => l.missingCatalog).length;
  if (missing > 0 && process.env.NODE_ENV !== "production") {
    console.info(
      `[supplier] ${missing} ligne(s) sans lien Taobao — optionnel, nom + taille suffisent pour BBDBuy`,
    );
  }

  try {
    await sendBbdBuyOperatorEmail(draft);
  } catch (err) {
    console.error("[supplier] operator email failed", order.reference, err);
  }

  if (process.env.NODE_ENV !== "production") {
    console.info(
      "[supplier] BBDBuy draft saved:",
      order.reference,
      draft.lines.map((l) => `${l.name}×${l.quantity}`).join(", "),
    );
  }
}

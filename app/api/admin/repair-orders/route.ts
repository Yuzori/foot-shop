import { NextResponse } from "next/server";

import { isAdminAuthorized } from "@/lib/admin-auth";
import { getOrderArchiveByReference } from "@/lib/order-archive-store";
import { enrichOrderArchiveForEmail } from "@/lib/enrich-order-archive-for-email";
import { fulfillPaidOrder } from "@/lib/order-paid";
import { sendOrderConfirmationEmail } from "@/lib/order-confirmation-email";
import { repairPrestaShopOrderStates } from "@/lib/repair-prestashop-orders";
import { resolveCheckoutNotificationEmail } from "@/lib/checkout-notification-email";
import { sendPaidOrderCustomerEmailsIfNeeded } from "@/lib/send-paid-order-customer-emails";
import { prestashop } from "@/services/prestashop";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Répare les états PrestaShop (payé Stripe mais PS en erreur, annule les abandons). */
export async function POST(request: Request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  }

  try {
  let limit = 80;
  let references: string[] = [];
  let action: string | undefined;
  let resendTo: string | undefined;
  try {
    const body = (await request.json()) as {
      limit?: number;
      references?: string[];
      action?: string;
      to?: string;
    };
    action = body.action;
    resendTo = body.to?.trim();
    if (typeof body.limit === "number" && body.limit > 0) {
      limit = Math.min(200, body.limit);
    }
    if (Array.isArray(body.references)) {
      references = body.references.map((ref) => ref.trim()).filter(Boolean);
    }
  } catch {
    // corps vide OK
  }

  if (action === "resend_customer_email" && references.length === 1) {
    const reference = references[0]!;
    const order = await prestashop.getOrderByReference(reference);
    if (!order) {
      return NextResponse.json({ message: "Commande introuvable." }, { status: 404 });
    }
    const archive = await getOrderArchiveByReference(reference);
    const emailArchive = await enrichOrderArchiveForEmail(archive, order.id);

    if (resendTo) {
      await sendOrderConfirmationEmail({
        to: resendTo,
        order,
        archive: emailArchive,
        firstName: emailArchive?.contact.firstName,
      });
      return NextResponse.json({
        message: `Email récap envoyé pour ${reference} → ${resendTo}.`,
        reference,
        to: resendTo,
        sent: true,
      });
    }

    const to =
      resolveCheckoutNotificationEmail({ archive: emailArchive }) ??
      (await prestashop.getCustomerEmailByOrderId(order.id));
    const sent = await sendPaidOrderCustomerEmailsIfNeeded({
      order,
      orderId: order.id,
      archive,
      force: true,
    });
    return NextResponse.json({
      message: sent
        ? `Email client renvoyé pour ${reference}${to ? ` → ${to}` : ""}.`
        : `Échec envoi email client pour ${reference}.`,
      reference,
      to: to ?? null,
      sent,
    });
  }

  if (references.length > 0) {
    const restored: string[] = [];
    const skipped: Array<{ reference: string; reason: string }> = [];
    for (const reference of references) {
      try {
        const order = await prestashop.getOrderByReference(reference);
        if (!order) {
          skipped.push({ reference, reason: "commande_introuvable" });
          continue;
        }
        await fulfillPaidOrder(order.id);
        restored.push(reference);
      } catch (error) {
        const reason =
          error instanceof Error ? error.message : "restauration_echouee";
        skipped.push({ reference, reason });
      }
    }
    return NextResponse.json({
      message: `${restored.length} commande(s) restaurée(s).`,
      restored,
      skipped,
    });
  }

  const result = await repairPrestaShopOrderStates(limit);

  return NextResponse.json({
    message: `${result.markedPaid} commande(s) marquée(s) payée(s), ${result.cancelled} annulée(s).`,
    ...result,
  });
  } catch (error) {
    console.error("[repair-orders] failed", error);
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Réparation impossible.",
      },
      { status: 500 },
    );
  }
}

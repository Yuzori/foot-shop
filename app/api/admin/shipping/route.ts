import { NextResponse } from "next/server";

import { mailConfig } from "@/config/mail";
import {
  getOrderShipping,
  listOrderShipping,
  markShippingEmailSent,
  upsertOrderShipping,
} from "@/lib/order-shipping-store";
import { sendShippingNotificationEmail } from "@/lib/shipping-notification-email";
import { prestashop } from "@/services/prestashop";

function readAuthSecret(request: Request): string {
  const bearer = request.headers.get("authorization");
  if (bearer?.startsWith("Bearer ")) return bearer.slice(7).trim();
  return request.headers.get("x-admin-secret")?.trim() ?? "";
}

function isAuthorized(request: Request): boolean {
  const secret = mailConfig.adminSecret;
  if (!secret) return false;
  return readAuthSecret(request) === secret;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "unauthorized" }, { status: 401 });
  }
  const items = await listOrderShipping();
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "unauthorized" }, { status: 401 });
  }

  let body: {
    reference?: string;
    trackingNumber?: string;
    carrierUrl?: string;
    customerEmail?: string;
    action?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "invalid_body" }, { status: 400 });
  }

  const reference = body.reference?.trim();
  const trackingNumber = body.trackingNumber?.trim() ?? "";
  const carrierUrl = body.carrierUrl?.trim() ?? "";

  if (!reference) {
    return NextResponse.json({ message: "reference_required" }, { status: 400 });
  }

  const order = await prestashop.getOrderByReference(reference);
  if (!order) {
    return NextResponse.json({ message: "order_not_found" }, { status: 404 });
  }

  const customerEmail =
    body.customerEmail?.trim().toLowerCase() ||
    (await prestashop.getCustomerEmailByOrderId(order.id)) ||
    null;

  const saved = await upsertOrderShipping({
    reference,
    trackingNumber,
    carrierUrl,
    customerEmail,
  });

  if (body.action === "send") {
    if (!trackingNumber || !carrierUrl) {
      return NextResponse.json(
        { message: "tracking_and_url_required" },
        { status: 422 },
      );
    }
    if (!customerEmail) {
      return NextResponse.json(
        { message: "customer_email_missing" },
        { status: 422 },
      );
    }

    let emailSent = false;
    let emailError: string | null = null;

    const emailResult = await sendShippingNotificationEmail({
      to: customerEmail,
      reference,
      trackingNumber,
      carrierUrl,
    });

    if (emailResult.delivered) {
      await markShippingEmailSent(reference);
      emailSent = true;
    } else {
      emailError =
        emailResult.error ??
        (emailResult.devMode
          ? "SMTP non configuré sur le serveur (variables SMTP_* manquantes)."
          : "Échec d'envoi email.");
      console.error("[admin/shipping] email failed", reference, emailError);
    }

    const updated = await getOrderShipping(reference);
    return NextResponse.json({
      ok: true,
      shipping: updated,
      emailSent,
      emailError,
    });
  }

  return NextResponse.json({ ok: true, shipping: saved });
}

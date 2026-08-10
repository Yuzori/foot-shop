import { NextResponse } from "next/server";

import { mailConfig } from "@/config/mail";
import { isTestOrderReference } from "@/lib/is-test-order";
import { purgeTestOrderArchives } from "@/lib/order-archive-store";
import { purgeTestShippingEntries } from "@/lib/order-shipping-store";
import {
  archiveSupplierOrderDraft,
  getSupplierOrderDraft,
  listSupplierOrderDrafts,
  markSupplierOrderSubmitted,
  purgeTestSupplierDrafts,
} from "@/lib/supplier-order-store";
import { notifySupplierOfOrder } from "@/lib/supplier-order";
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

/** Liste les brouillons BBDBuy en attente de saisie. */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "unauthorized" }, { status: 401 });
  }

  await Promise.all([
    purgeTestOrderArchives(),
    purgeTestShippingEntries(),
    purgeTestSupplierDrafts(),
  ]);

  const drafts = (await listSupplierOrderDrafts()).filter(
    (d) => !isTestOrderReference(d.reference),
  );
  return NextResponse.json({
    pending: drafts.filter((d) => d.status === "pending"),
    submitted: drafts.filter((d) => d.status === "submitted"),
    archived: drafts.filter((d) => d.status === "archived"),
  });
}

/** Marque une commande comme transmise à BBDBuy. */
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "unauthorized" }, { status: 401 });
  }

  let body: { reference?: string; action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "invalid_body" }, { status: 400 });
  }

  const reference = body.reference?.trim();
  if (!reference) {
    return NextResponse.json({ message: "reference_required" }, { status: 400 });
  }

  if (body.action === "mark_submitted") {
    const draft = await markSupplierOrderSubmitted(reference);
    if (!draft) {
      return NextResponse.json({ message: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, draft });
  }

  if (body.action === "archive") {
    const draft = await archiveSupplierOrderDraft(reference);
    if (!draft) {
      return NextResponse.json({ message: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, draft });
  }

  if (body.action === "resend_email") {
    const order = await prestashop.getOrderByReference(reference);
    if (!order) {
      return NextResponse.json({ message: "order_not_found" }, { status: 404 });
    }
    try {
      await notifySupplierOfOrder(order, order.id, { force: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "email_failed";
      return NextResponse.json({ message }, { status: 502 });
    }
    const draft = await getSupplierOrderDraft(reference);
    return NextResponse.json({ ok: true, draft });
  }

  const draft = await getSupplierOrderDraft(reference);
  if (!draft) {
    return NextResponse.json({ message: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ draft });
}

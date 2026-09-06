import { NextResponse } from "next/server";

import {
  ensureSupplierDraftFromArchiveReference,
} from "@/lib/ensure-supplier-draft";
import { runAdminOrderRecovery } from "@/lib/admin-order-recovery";
import { listAbandonedCheckouts } from "@/lib/abandoned-checkouts";
import { dismissOrderFromAdminRecovery, clearOrderDismissal } from "@/lib/order-admin-dismissals";
import { mailConfig } from "@/config/mail";
import {
  archiveSupplierOrderDraft,
  deleteSupplierOrderDraft,
  getSupplierOrderDraft,
  listSupplierOrderDrafts,
  markSupplierOrderSubmitted,
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

  const url = new URL(request.url);
  const shouldRecover = url.searchParams.get("recover") === "1";

  const [drafts, abandoned] = await Promise.all([
    listSupplierOrderDrafts(),
    listAbandonedCheckouts().catch((err) => {
      console.error("[supplier-orders] abandoned list failed", err);
      return [];
    }),
  ]);

  if (!shouldRecover) {
    return NextResponse.json({
      pending: drafts.filter((d) => d.status === "pending"),
      submitted: drafts.filter((d) => d.status === "submitted"),
      archived: drafts.filter((d) => d.status === "archived"),
      abandoned,
      recovered: 0,
    });
  }

  const recovery = await runAdminOrderRecovery(100).catch((err) => {
    console.error("[supplier-orders] recovery failed", err);
    return null;
  });

  const refreshed = await listSupplierOrderDrafts();
  return NextResponse.json({
    pending: refreshed.filter((d) => d.status === "pending"),
    submitted: refreshed.filter((d) => d.status === "submitted"),
    archived: refreshed.filter((d) => d.status === "archived"),
    abandoned,
    recovered: recovery?.supplierDrafts ?? 0,
    recovery,
  });
}

/** Marque une commande comme transmise à BBDBuy. */
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "unauthorized" }, { status: 401 });
  }

  let body: { reference?: string; action?: string; customerId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "invalid_body" }, { status: 400 });
  }

  if (body.action === "repair_customer") {
    const customerId = body.customerId?.trim();
    if (!customerId) {
      return NextResponse.json({ message: "customer_id_required" }, { status: 400 });
    }
    const result = await prestashop.repairCustomerBackOffice(customerId);
    if (!result.ok) {
      return NextResponse.json(
        { message: result.error ?? "repair_failed" },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true });
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
    await dismissOrderFromAdminRecovery(reference, "archived");
    return NextResponse.json({ ok: true, draft });
  }

  if (body.action === "delete") {
    const ok = await deleteSupplierOrderDraft(reference);
    if (!ok) {
      return NextResponse.json({ message: "not_found" }, { status: 404 });
    }
    await dismissOrderFromAdminRecovery(reference, "deleted");
    return NextResponse.json({ ok: true });
  }

  if (body.action === "recover_draft") {
    await clearOrderDismissal(reference);
    let ok = await ensureSupplierDraftFromArchiveReference(reference);
    if (!ok) {
      const order = await prestashop.getOrderByReference(reference);
      if (!order) {
        return NextResponse.json({ message: "order_not_found" }, { status: 404 });
      }
      await notifySupplierOfOrder(order, order.id, { force: true });
      ok = true;
    }
    const draft = await getSupplierOrderDraft(reference);
    if (!draft) {
      return NextResponse.json({ message: "recover_failed" }, { status: 502 });
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

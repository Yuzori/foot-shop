import { NextResponse } from "next/server";

import { isAdminAuthorized } from "@/lib/admin-auth";
import { listStripeAdminOrders, resetAbandonsCutoff } from "@/lib/stripe-admin-orders";

export const runtime = "nodejs";

/** Commandes et abandons depuis Stripe (source de vérité). */
export async function GET(request: Request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ message: "unauthorized" }, { status: 401 });
  }

  const limitParam = new URL(request.url).searchParams.get("limit");
  const limit = Math.min(100, Math.max(10, Number(limitParam) || 50));

  try {
    const payload = await listStripeAdminOrders(limit);
    return NextResponse.json(payload);
  } catch (err) {
    console.error("[stripe-orders] list failed", err);
    return NextResponse.json({ message: "stripe_list_failed" }, { status: 502 });
  }
}

/** Reset la liste des abandons affichés (les nouveaux réapparaissent après). */
export async function POST(request: Request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ message: "unauthorized" }, { status: 401 });
  }

  let body: { action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "invalid_body" }, { status: 400 });
  }

  if (body.action !== "reset_abandons") {
    return NextResponse.json({ message: "unknown_action" }, { status: 400 });
  }

  const since = await resetAbandonsCutoff();
  const payload = await listStripeAdminOrders(50);
  return NextResponse.json({ ok: true, since, ...payload });
}

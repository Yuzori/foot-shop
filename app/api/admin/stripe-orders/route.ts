import { NextResponse } from "next/server";

import { isAdminAuthorized } from "@/lib/admin-auth";
import { listStripeAdminOrders } from "@/lib/stripe-admin-orders";

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

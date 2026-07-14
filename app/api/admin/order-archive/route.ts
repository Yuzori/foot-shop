import { NextResponse } from "next/server";

import { isAdminAuthorized } from "@/lib/admin-auth";
import {
  getOrderArchive,
  listOrderArchives,
} from "@/lib/order-archive-store";

/** Historique sécurisé des commandes (admin uniquement). */
export async function GET(request: Request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id")?.trim();
  if (id) {
    const record = await getOrderArchive(id);
    if (!record) {
      return NextResponse.json({ message: "Introuvable." }, { status: 404 });
    }
    return NextResponse.json({ record });
  }

  const limit = Math.min(
    1000,
    Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "200", 10) || 200),
  );
  const records = await listOrderArchives(limit);
  return NextResponse.json({
    total: records.length,
    records: records.map((r) => ({
      id: r.id,
      reference: r.reference,
      orderId: r.orderId,
      createdAt: r.createdAt,
      paidAt: r.paidAt,
      status: r.status,
      email: r.contact.email,
      total: r.total,
      currency: r.currency,
      lineCount: r.lines.length,
      source: r.source,
    })),
  });
}

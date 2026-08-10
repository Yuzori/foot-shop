import { NextResponse } from "next/server";

import { isAdminAuthorized } from "@/lib/admin-auth";
import {
  countOrderBackups,
  listRecentOrderBackups,
} from "@/lib/order-backup-store";

/** Consultation admin du journal de sauvegarde des commandes. */
export async function GET(request: Request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = Math.min(
    500,
    Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "50", 10) || 50),
  );

  const [entries, total] = await Promise.all([
    listRecentOrderBackups(limit),
    countOrderBackups(),
  ]);

  return NextResponse.json({ total, entries });
}

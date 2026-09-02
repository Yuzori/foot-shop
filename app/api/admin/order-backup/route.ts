import { NextResponse } from "next/server";

import { isAdminAuthorized } from "@/lib/admin-auth";
import {
  countOrderBackups,
  listRecentOrderBackups,
} from "@/lib/order-backup-store";
import { restoreArchivesFromBackups } from "@/lib/restore-order-archives";

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

/** Restaure l'historique depuis le journal append-only. */
export async function POST(request: Request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  }

  let body: {
    action?: string;
    references?: string[];
    excludeReferences?: string[];
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ message: "Requête invalide." }, { status: 400 });
  }

  if (body.action !== "restore_archives") {
    return NextResponse.json({ message: "action_invalide" }, { status: 400 });
  }

  const result = await restoreArchivesFromBackups({
    references: body.references,
    excludeReferences: body.excludeReferences,
    paidOnly: true,
  });

  return NextResponse.json({ ok: true, ...result });
}

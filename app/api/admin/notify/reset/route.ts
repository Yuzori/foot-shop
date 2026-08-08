import { NextResponse } from "next/server";

import { isAdminAuthorized } from "@/lib/admin-auth";
import { resetNotifyPopups } from "@/lib/reset-notify-state";

/**
 * Réinitialise popup + compteur nouveautés (admin).
 * POST avec header `Authorization: Bearer <ADMIN_SECRET>`
 */
export async function POST(request: Request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  }

  const result = await resetNotifyPopups();
  return NextResponse.json({
    message: "File popup vidée, catalogue marqué comme notifié.",
    ...result,
  });
}

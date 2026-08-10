import { NextResponse } from "next/server";

import { isAdminAuthorized } from "@/lib/admin-auth";
import { getLiveSiteStats } from "@/lib/live-site-stats";

export const runtime = "nodejs";

/** Stats boutique en direct : visiteurs, paniers actifs. */
export async function GET(request: Request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ message: "unauthorized" }, { status: 401 });
  }

  return NextResponse.json(getLiveSiteStats());
}

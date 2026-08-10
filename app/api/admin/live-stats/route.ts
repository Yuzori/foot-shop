import { NextResponse } from "next/server";

import { isAdminAuthorized } from "@/lib/admin-auth";
import {
  getSiteStatsRecap,
  isRecapPeriod,
  resetSiteAnalytics,
} from "@/lib/live-site-analytics";
import {
  clearLiveSessions,
  getLiveSiteStats,
} from "@/lib/live-site-stats";
import type { RecapPeriod } from "@/lib/live-site-stats-types";

export const runtime = "nodejs";

/** Stats boutique : temps réel + récap par période. */
export async function GET(request: Request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ message: "unauthorized" }, { status: 401 });
  }

  const periodParam = new URL(request.url).searchParams.get("period");
  const period: RecapPeriod = isRecapPeriod(periodParam) ? periodParam : "day";

  const [live, recap] = await Promise.all([
    Promise.resolve(getLiveSiteStats()),
    getSiteStatsRecap(period),
  ]);

  return NextResponse.json({ live, recap });
}

/** Réinitialise les compteurs visiteurs (live + historique). */
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

  if (body.action !== "reset") {
    return NextResponse.json({ message: "unknown_action" }, { status: 400 });
  }

  clearLiveSessions();
  await resetSiteAnalytics();

  return NextResponse.json({ ok: true });
}

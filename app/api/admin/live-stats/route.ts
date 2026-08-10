import { NextResponse } from "next/server";

import { isAdminAuthorized } from "@/lib/admin-auth";
import {
  getSiteStatsRecap,
  isRecapPeriod,
} from "@/lib/live-site-analytics";
import type { RecapPeriod } from "@/lib/live-site-stats-types";
import { getLiveSiteStats } from "@/lib/live-site-stats";

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

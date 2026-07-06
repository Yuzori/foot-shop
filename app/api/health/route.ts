import { NextResponse } from "next/server";

import { serverConfig } from "@/config";

/** Sonde Render / monitoring — ne expose aucun secret. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    prestashop: serverConfig.isConfigured,
    time: new Date().toISOString(),
  });
}

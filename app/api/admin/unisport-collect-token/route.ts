import { NextResponse } from "next/server";

import { isAdminAuthorized } from "@/lib/admin-auth";
import { issueUnisportCollectToken } from "@/lib/unisport-collect-token";

export const runtime = "nodejs";

/** Génère un token pour installer le bookmarklet Unisport. */
export async function POST(request: Request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ message: "unauthorized" }, { status: 401 });
  }

  const token = await issueUnisportCollectToken();
  return NextResponse.json({ ok: true, token });
}

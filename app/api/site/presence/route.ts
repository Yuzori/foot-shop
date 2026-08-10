import { NextResponse } from "next/server";

import {
  recordLivePresence,
  removeLiveSession,
} from "@/lib/live-site-stats";

export const runtime = "nodejs";

/** Heartbeat visiteur (panier + page) — alimente les stats admin temps réel. */
export async function POST(request: Request) {
  let body: {
    sessionId?: string;
    cartLines?: number;
    cartItems?: number;
    pathname?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "invalid_body" }, { status: 400 });
  }

  const sessionId = body.sessionId?.trim();
  if (!sessionId || sessionId.length > 80) {
    return NextResponse.json({ message: "session_required" }, { status: 400 });
  }

  recordLivePresence({
    sessionId,
    cartLines: Number(body.cartLines) || 0,
    cartItems: Number(body.cartItems) || 0,
    pathname: body.pathname,
  });

  return NextResponse.json({ ok: true });
}

/** Retire une session des stats (ex. connexion admin). */
export async function DELETE(request: Request) {
  let body: { sessionId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "invalid_body" }, { status: 400 });
  }

  const sessionId = body.sessionId?.trim();
  if (!sessionId || sessionId.length > 80) {
    return NextResponse.json({ message: "session_required" }, { status: 400 });
  }

  removeLiveSession(sessionId);
  return NextResponse.json({ ok: true });
}

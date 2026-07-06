import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { readUserPreferences, writeUserPreferences } from "@/lib/user-preferences";
import type { CartLine } from "@/types/domain";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Non authentifié." }, { status: 401 });
  }

  const prefs = await readUserPreferences(session.id);
  return NextResponse.json({
    cart: prefs.cart,
    favorites: prefs.favorites,
  });
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Non authentifié." }, { status: 401 });
  }

  let body: { cart?: CartLine[]; favorites?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Requête invalide." }, { status: 400 });
  }

  const current = await readUserPreferences(session.id);
  await writeUserPreferences(session.id, {
    cart: Array.isArray(body.cart) ? body.cart : current.cart,
    favorites: Array.isArray(body.favorites) ? body.favorites : current.favorites,
  });

  return NextResponse.json({ message: "Préférences enregistrées." });
}

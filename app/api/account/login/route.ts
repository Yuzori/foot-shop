import { NextResponse } from "next/server";

import { setSession, verifyPassword } from "@/lib/auth";
import { rateLimitOrReject } from "@/lib/rate-limit";
import { prestashop } from "@/services/prestashop";

export async function POST(request: Request) {
  const limited = rateLimitOrReject(request, "login", 10, 60_000);
  if (limited) return limited;

  if (!prestashop.isConfigured) {
    return NextResponse.json(
      { message: "Service indisponible (back office non configuré)." },
      { status: 503 },
    );
  }

  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Requête invalide." }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";

  if (!email || !password) {
    return NextResponse.json(
      { message: "Email et mot de passe requis." },
      { status: 422 },
    );
  }

  const account = await prestashop.getCustomerAuthByEmail(email);
  const valid =
    account !== null && (await verifyPassword(password, account.passwordHash));

  if (!account || !valid) {
    return NextResponse.json(
      { message: "Email ou mot de passe incorrect." },
      { status: 401 },
    );
  }

  const user = {
    id: String(account.id),
    email: account.email,
    firstName: account.firstName,
    lastName: account.lastName,
  };
  await setSession(user);

  return NextResponse.json({ user });
}

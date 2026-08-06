import { NextResponse } from "next/server";

import { mailConfig } from "@/config/mail";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { runAllEmailTests } from "@/lib/test-all-emails";

/** État de la config mail (admin). */
export async function GET(request: Request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  }

  return NextResponse.json({
    enabled: mailConfig.enabled,
    provider: mailConfig.provider,
    from: mailConfig.from,
    resend: mailConfig.resendEnabled,
    smtp: mailConfig.smtpEnabled,
  });
}

/**
 * Envoie un exemplaire de test de chaque email transactionnel.
 * POST { "to": "vous@example.com" }
 * Header : x-admin-secret
 */
export async function POST(request: Request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  }

  if (!mailConfig.enabled) {
    return NextResponse.json(
      {
        message:
          "Email non configuré (RESEND_API_KEY ou SMTP). Les envois sont loggés en console uniquement.",
        enabled: false,
        provider: mailConfig.provider,
      },
      { status: 503 },
    );
  }

  let body: { to?: string; delayMs?: number };
  try {
    body = (await request.json()) as { to?: string; delayMs?: number };
  } catch {
    return NextResponse.json({ message: "Corps JSON invalide." }, { status: 400 });
  }

  const to = body.to?.trim();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return NextResponse.json(
      { message: "Champ « to » (email valide) requis." },
      { status: 422 },
    );
  }

  const report = await runAllEmailTests(to, {
    delayMs: typeof body.delayMs === "number" ? body.delayMs : 600,
  });

  return NextResponse.json({
    message: `Tests terminés : ${report.passed}/${report.results.length} envoyés.`,
    ...report,
  });
}

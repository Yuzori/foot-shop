import { NextResponse } from "next/server";

import { mailConfig } from "@/config/mail";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { runNotifyJob } from "@/lib/run-notify-job";

function isAuthorized(request: Request): boolean {
  return isAdminAuthorized(request);
}

/** État SMTP (admin uniquement). */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  }
  return NextResponse.json({
    provider: mailConfig.provider,
    smtp: mailConfig.smtpEnabled,
    resend: mailConfig.resendEnabled,
    adminSecretSet: Boolean(mailConfig.adminSecret),
  });
}

/**
 * Envoie alertes nouveautés + traite les cloches stock.
 * POST avec header `x-admin-secret: <ADMIN_SECRET>`
 */
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  }
  return runNotifyJob();
}

import { NextResponse } from "next/server";

import { publicConfig } from "@/config";
import { mailConfig } from "@/config/mail";
import { emailHeading, emailLayout, emailParagraph } from "@/lib/email-template";
import { sendMail } from "@/lib/mailer";
import { createResetCode } from "@/lib/reset-store";
import { rateLimitOrReject } from "@/lib/rate-limit";
import { prestashop } from "@/services/prestashop";

/**
 * Requests a password-reset code.
 *
 * Always returns 200 with the same message (no user enumeration): we never
 * reveal whether an email exists. A code is only generated/sent if the account
 * actually exists.
 */
export async function POST(request: Request) {
  const limited = rateLimitOrReject(request, "forgot", 6, 60_000);
  if (limited) return limited;

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Requête invalide." }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const generic = NextResponse.json({
    message:
      "Si un compte existe pour cet email, un code de réinitialisation vient d'être envoyé.",
  });

  if (!email) return generic;

  const account = await prestashop.getCustomerAuthByEmail(email);
  if (!account) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[auth:forgot] no account for ${email}`);
    }
    return generic;
  }

  const code = createResetCode(email);

  const mailResult = await sendMail({
    to: email,
    subject: `${publicConfig.siteName} — Code de réinitialisation`,
    text: `Votre code de réinitialisation est : ${code}\nCe code expire dans 15 minutes.\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.`,
    html: emailLayout(`
      ${emailHeading("Réinitialisation du mot de passe")}
      ${emailParagraph("Voici votre code de réinitialisation :")}
      <p style="font-size:28px;font-weight:700;letter-spacing:6px;background:#f6f6f6;padding:16px;text-align:center;border-radius:12px;margin:16px 0">${code}</p>
      ${emailParagraph('<span style="color:#666;font-size:13px">Ce code expire dans 15 minutes. Si vous n\'êtes pas à l\'origine de cette demande, ignorez cet email.</span>')}
    `),
  });

  if (!mailResult.delivered) {
    console.error(
      `[auth:forgot] mail not delivered to ${email}`,
      mailResult.error ?? (mailResult.devMode ? "smtp_not_configured" : "unknown"),
    );
    if (mailConfig.enabled && process.env.NODE_ENV === "development") {
      console.info(`[auth:dev] Code reset pour ${email}: ${code}`);
    }
  }

  return generic;
}

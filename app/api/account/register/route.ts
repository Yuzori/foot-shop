import { NextResponse } from "next/server";

import { publicConfig } from "@/config";
import {
  emailHeading,
  emailLayout,
  emailParagraph,
} from "@/lib/email-template";
import { sendMail } from "@/lib/mailer";
import { createRegistrationCode } from "@/lib/register-pending-store";
import { prestashop } from "@/services/prestashop";

/** Étape 1 : envoie un code de vérification par email (compte pas encore créé). */
export async function POST(request: Request) {
  if (!prestashop.isConfigured) {
    return NextResponse.json({ message: "Service indisponible." }, { status: 503 });
  }

  let body: {
    firstName?: string;
    lastName?: string;
    email?: string;
    password?: string;
    acceptTerms?: boolean;
    newsletter?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Requête invalide." }, { status: 400 });
  }

  const firstName = (body.firstName ?? "").trim();
  const lastName = (body.lastName ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const newsletter = Boolean(body.newsletter);

  if (!firstName || !lastName || !email || password.length < 6) {
    return NextResponse.json(
      { message: "Champs manquants ou mot de passe trop court (min. 6)." },
      { status: 422 },
    );
  }

  if (!body.acceptTerms) {
    return NextResponse.json(
      { message: "Vous devez accepter les conditions générales." },
      { status: 422 },
    );
  }

  const existing = await prestashop.getCustomerAuthByEmail(email);
  if (existing) {
    return NextResponse.json(
      { message: "Un compte existe déjà avec cet email." },
      { status: 409 },
    );
  }

  const code = createRegistrationCode({
    firstName,
    lastName,
    email,
    password,
    newsletter,
  });

  await sendMail({
    to: email,
    subject: `${publicConfig.siteName} — Code de vérification`,
    text: `Votre code de vérification : ${code}\nCe code expire dans 15 minutes.`,
    html: emailLayout(`
      ${emailHeading("Vérifiez votre email")}
      ${emailParagraph("Bienvenue ! Voici votre code pour activer votre compte :")}
      <p style="font-size:28px;font-weight:700;letter-spacing:6px;background:#f6f6f6;padding:16px;text-align:center;border-radius:12px;margin:16px 0">${code}</p>
      ${emailParagraph('<span style="color:#666;font-size:13px">Ce code expire dans 15 minutes.</span>')}
    `),
  });

  return NextResponse.json({
    needsVerification: true,
    message: "Un code de vérification vient d'être envoyé à votre adresse email.",
  });
}

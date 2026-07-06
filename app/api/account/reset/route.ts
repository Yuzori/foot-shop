import { NextResponse } from "next/server";

import { publicConfig } from "@/config";
import {
  emailHeading,
  emailLayout,
  emailParagraph,
} from "@/lib/email-template";
import { sendMail } from "@/lib/mailer";
import { verifyResetCode } from "@/lib/reset-store";
import { prestashop } from "@/services/prestashop";

export async function POST(request: Request) {
  let body: { email?: string; code?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Requête invalide." }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const code = (body.code ?? "").trim();
  const password = body.password ?? "";

  if (!email || !code || password.length < 6) {
    return NextResponse.json(
      { message: "Champs invalides ou mot de passe trop court (min. 6)." },
      { status: 422 },
    );
  }

  if (!verifyResetCode(email, code)) {
    return NextResponse.json(
      { message: "Code invalide ou expiré." },
      { status: 400 },
    );
  }

  const account = await prestashop.getCustomerAuthByEmail(email);
  if (!account) {
    return NextResponse.json({ message: "Compte introuvable." }, { status: 404 });
  }

  const result = await prestashop.updateCustomerPassword(account.id, password);
  if (!result.ok) {
    const isVerify = result.error === "password_verify_failed";
    return NextResponse.json(
      {
        message: isVerify
          ? "Le mot de passe n'a pas pu être enregistré correctement. Réessayez ou contactez le support."
          : "Impossible de mettre à jour le mot de passe. Vérifiez les permissions Webservice (customers : écriture).",
        detail: result.error,
      },
      { status: 502 },
    );
  }

  await sendMail({
    to: email,
    subject: `${publicConfig.siteName} — Mot de passe modifié`,
    text: `Votre mot de passe ${publicConfig.siteName} a bien été modifié. Si vous n'êtes pas à l'origine de ce changement, contactez-nous immédiatement.`,
    html: emailLayout(`
      ${emailHeading("Mot de passe modifié")}
      ${emailParagraph("Votre mot de passe a bien été mis à jour. Vous pouvez vous connecter avec votre nouveau mot de passe.")}
      ${emailParagraph('<span style="color:#666;font-size:13px">Si vous n\'êtes pas à l\'origine de cette modification, contactez-nous immédiatement.</span>')}
    `),
  });

  return NextResponse.json({ message: "Mot de passe mis à jour." });
}

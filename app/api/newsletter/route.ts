import { NextResponse } from "next/server";

import { publicConfig } from "@/config";
import {
  emailButton,
  emailHeading,
  emailLayout,
  emailParagraph,
} from "@/lib/email-template";
import { sendMail } from "@/lib/mailer";
import { addGuestNewsletterEmail } from "@/lib/newsletter-subscribers";
import { prestashop } from "@/services/prestashop";

/** Inscription newsletter (compte PrestaShop ou invité). */
export async function POST(request: Request) {
  if (!prestashop.isConfigured) {
    return NextResponse.json({ message: "Service indisponible." }, { status: 503 });
  }

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Requête invalide." }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ message: "Email invalide." }, { status: 422 });
  }

  const account = await prestashop.subscribeCustomerNewsletter(email);
  if (account.ok) {
    return NextResponse.json({
      message: account.already
        ? "Vous êtes déjà inscrit à la newsletter."
        : "Inscription confirmée ! Vous recevrez nos nouveautés par email.",
    });
  }

  const { added } = await addGuestNewsletterEmail(email);
  const base = publicConfig.siteUrl.replace(/\/$/, "");

  await sendMail({
    to: email,
    subject: `${publicConfig.siteName} — Bienvenue dans la newsletter`,
    text: `Merci pour votre inscription à la newsletter ${publicConfig.siteName}.\n${base}`,
    html: emailLayout(`
      ${emailHeading("Bienvenue !")}
      ${emailParagraph(`Vous êtes inscrit à la newsletter <strong>${publicConfig.siteName}</strong>.`)}
      ${emailParagraph("Nouveautés, éditions limitées et retours en stock — directement dans votre boîte mail.")}
      ${emailButton(`${base}/catalogue`, "Découvrir la boutique")}
    `),
  });

  return NextResponse.json({
    message: added
      ? "Inscription confirmée ! Vous recevrez nos nouveautés par email."
      : "Vous êtes déjà inscrit à la newsletter.",
  });
}

import "server-only";

import { publicConfig } from "@/config";
import { routes } from "@/config/site";
import { welcomePromo } from "@/config/promotions";
import {
  emailButton,
  emailHeading,
  emailLayout,
  emailParagraph,
  escapeHtml,
} from "@/lib/email-template";
import { assertMailDelivered, sendMail } from "@/lib/mailer";
import { getSiteUrl } from "@/lib/site-url";

export async function sendWelcomePromoEmail(input: {
  to: string;
  firstName: string;
}): Promise<void> {
  if (!welcomePromo.enabled) return;

  const base = getSiteUrl();
  const checkoutUrl = `${base}${routes.checkout}`;

  const body = `
    ${emailHeading("Bienvenue chez Foot Shop")}
    ${emailParagraph(`Bonjour ${escapeHtml(input.firstName)},`)}
    ${emailParagraph(`Merci d'avoir créé votre compte. Profitez de <strong>${escapeHtml(welcomePromo.label)}</strong> sur votre première commande :`)}
    ${emailParagraph(`Le <strong>${escapeHtml(welcomePromo.checkoutLabel.toLowerCase())}</strong> s'appliquera automatiquement au paiement dès 3 articles (une seule fois par compte).`)}
    ${emailButton(checkoutUrl, "Commander maintenant")}
  `;

  const text = [
    "Bienvenue chez Foot Shop",
    "",
    `Bonjour ${input.firstName},`,
    "",
    `${welcomePromo.label} sur votre première commande.`,
    `${welcomePromo.checkoutLabel} au paiement dès 3 articles — une seule utilisation.`,
    "",
    checkoutUrl,
  ].join("\n");

  const result = await sendMail({
    to: input.to,
    subject: `Votre offre de bienvenue — ${publicConfig.siteName}`,
    html: emailLayout(body),
    text,
  });
  assertMailDelivered(result, `welcome promo → ${input.to}`);
}

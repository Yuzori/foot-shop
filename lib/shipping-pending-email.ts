import "server-only";

import { publicConfig } from "@/config";
import { routes } from "@/config/site";
import { getSiteUrl } from "@/lib/site-url";
import {
  emailButton,
  emailHeading,
  emailLayout,
  emailOrderSupportBlock,
  emailParagraph,
  escapeHtml,
  orderSupportNoticeText,
} from "@/lib/email-template";
import { assertMailDelivered, sendMail } from "@/lib/mailer";

/** Prévient le client que le lien Chronopost arrivera sous 2 à 7 jours ouvrés. */
export async function sendShippingPendingEmail(input: {
  to: string;
  reference: string;
  firstName?: string;
}): Promise<void> {
  const base = getSiteUrl();
  const trackingUrl = `${base}${routes.tracking}?ref=${encodeURIComponent(input.reference)}`;
  const contactUrl = `${base}${routes.contact}`;
  const name = input.firstName?.trim() || "Client";

  const body = `
    ${emailHeading("Votre commande est en préparation")}
    ${emailParagraph(`Bonjour ${escapeHtml(name)},`)}
    ${emailParagraph(`Bonne nouvelle : votre commande <strong>${escapeHtml(input.reference)}</strong> est bien enregistrée et en cours de préparation dans notre entrepôt.`)}
    ${emailParagraph("Comptez <strong>2 à 7 jours ouvrés</strong> pour recevoir par email le <strong>lien de suivi Chronopost</strong> dès que votre colis sera remis au transporteur.")}
    ${emailParagraph("En attendant, vous pouvez consulter l'état de votre commande à tout moment :")}
    ${emailButton(trackingUrl, "Suivre ma commande")}
    ${emailParagraph('<span style="color:#666;font-size:13px">Vous recevrez un second email dès l\'expédition avec le lien Chronopost.</span>')}
    ${emailOrderSupportBlock(contactUrl)}
  `;

  const text = [
    `Bonjour ${name},`,
    "",
    `Votre commande ${input.reference} est en préparation.`,
    "",
    "Comptez 2 à 7 jours ouvrés pour recevoir par email le lien de suivi Chronopost dès l'expédition de votre colis.",
    "",
    `Suivre la commande : ${trackingUrl}`,
    "",
    orderSupportNoticeText(contactUrl),
    "",
    `— ${publicConfig.siteName}`,
  ].join("\n");

  const result = await sendMail({
    to: input.to,
    subject: `Suivi colis bientôt disponible — ${input.reference}`,
    html: emailLayout(body),
    text,
  });

  assertMailDelivered(result, `préparation / suivi imminent → ${input.to}`);
}

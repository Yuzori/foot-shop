import "server-only";

import { publicConfig } from "@/config";
import { routes } from "@/config/site";
import { getSiteUrl } from "@/lib/site-url";
import {
  emailButton,
  emailHeading,
  emailLayout,
  emailParagraph,
  escapeHtml,
} from "@/lib/email-template";
import { assertMailDelivered, sendMail } from "@/lib/mailer";

/** Prévient le client qu'un email de suivi colis arrivera sous 48 h. */
export async function sendShippingPendingEmail(input: {
  to: string;
  reference: string;
  firstName?: string;
}): Promise<void> {
  const base = getSiteUrl();
  const trackingUrl = `${base}${routes.tracking}?ref=${encodeURIComponent(input.reference)}`;
  const name = input.firstName?.trim() || "Client";

  const body = `
    ${emailHeading("Votre commande est en préparation")}
    ${emailParagraph(`Bonjour ${escapeHtml(name)},`)}
    ${emailParagraph(`Bonne nouvelle : votre commande <strong>${escapeHtml(input.reference)}</strong> est bien enregistrée et en cours de préparation dans notre entrepôt.`)}
    ${emailParagraph("Dans les <strong>prochaines 48 heures</strong>, vous recevrez un email avec le <strong>numéro de suivi</strong> dès que votre colis sera remis au transporteur.")}
    ${emailParagraph("En attendant, vous pouvez consulter l'état de votre commande à tout moment :")}
    ${emailButton(trackingUrl, "Suivre ma commande")}
    ${emailParagraph('<span style="color:#666;font-size:13px">Vous recevrez un second email dès l\'expédition avec le lien direct vers le transporteur.</span>')}
  `;

  const text = [
    `Bonjour ${name},`,
    "",
    `Votre commande ${input.reference} est en préparation.`,
    "",
    "Dans les prochaines 48 heures, vous recevrez un email avec le numéro de suivi dès l'expédition de votre colis.",
    "",
    `Suivre la commande : ${trackingUrl}`,
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

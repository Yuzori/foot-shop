import "server-only";

import { publicConfig } from "@/config";
import { routes } from "@/config/site";
import {
  emailButton,
  emailHeading,
  emailLayout,
  emailParagraph,
  escapeHtml,
} from "@/lib/email-template";
import { sendMail, type SendMailResult } from "@/lib/mailer";

export async function sendShippingNotificationEmail(input: {
  to: string;
  reference: string;
  trackingNumber: string;
  carrierUrl: string;
}): Promise<SendMailResult> {
  const base = publicConfig.siteUrl.replace(/\/$/, "");
  const siteTracking = `${base}${routes.tracking}?ref=${encodeURIComponent(input.reference)}`;

  return sendMail({
    to: input.to,
    subject: `Votre colis est en route — ${input.reference}`,
    text: [
      `Bonne nouvelle ! Votre commande ${input.reference} a été expédiée.`,
      "",
      `Numéro de suivi : ${input.trackingNumber}`,
      `Suivre sur le transporteur : ${input.carrierUrl}`,
      "",
      `Suivi sur ${publicConfig.siteName} : ${siteTracking}`,
    ].join("\n"),
    html: emailLayout(`
      ${emailHeading("Votre colis est en route")}
      ${emailParagraph(`Votre commande <strong>${escapeHtml(input.reference)}</strong> a été expédiée.`)}
      ${emailParagraph(`<strong>Numéro de suivi :</strong> ${escapeHtml(input.trackingNumber)}`)}
      ${emailButton(input.carrierUrl, "Suivre sur le transporteur")}
      ${emailParagraph(`Vous pouvez aussi consulter le suivi sur <a href="${escapeHtml(siteTracking)}" style="color:#3DA8F5">${escapeHtml(publicConfig.siteName)}</a>.`)}
    `),
  });
}

import "server-only";

import { firstOrderThankYouPromo } from "@/config/promotions";
import { getSiteUrl } from "@/lib/site-url";
import { routes } from "@/config/site";
import {
  emailButton,
  emailHeading,
  emailLayout,
  emailParagraph,
  escapeHtml,
} from "@/lib/email-template";
import { assertMailDelivered, sendMail } from "@/lib/mailer";

/** Email de remerciement après la 1ʳᵉ commande avec code promo -10 %. */
export async function sendFirstOrderThankYouEmail(input: {
  to: string;
  firstName?: string;
  reference: string;
}): Promise<void> {
  const base = getSiteUrl();
  const name = input.firstName?.trim() || "Client";
  const code = firstOrderThankYouPromo.code;

  const body = `
    ${emailHeading("Merci pour votre confiance")}
    ${emailParagraph(`Bonjour ${escapeHtml(name)},`)}
    ${emailParagraph(`Votre commande <strong>${escapeHtml(input.reference)}</strong> est bien enregistrée. Pour vous remercier, voici <strong>${firstOrderThankYouPromo.percent} %</strong> sur votre prochaine commande.`)}
    <p style="margin:20px 0;padding:16px 20px;border-radius:12px;background:#f0f9ff;border:1px dashed #66BAFF;font-size:18px;font-weight:700;letter-spacing:0.12em;text-align:center;color:#0a0a0a">${escapeHtml(code)}</p>
    ${emailParagraph("Saisissez ce code au paiement lors de votre prochain achat.")}
    ${emailButton(`${base}${routes.catalogue}`, "Découvrir la boutique")}
    ${emailParagraph("À très bientôt sur Foot Shop.")}
  `;

  const result = await sendMail({
    to: input.to,
    subject: `Merci pour votre commande — ${code} pour vous`,
    html: emailLayout(body),
    text: [
      `Merci ${name} !`,
      `Commande ${input.reference} confirmée.`,
      `Code promo : ${code} (${firstOrderThankYouPromo.percent} % sur votre prochaine commande)`,
      `${base}${routes.catalogue}`,
    ].join("\n"),
  });

  assertMailDelivered(result, `remerciement 1ʳᵉ commande → ${input.to}`);
}

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
import { formatPrice } from "@/lib/format";
import { assertMailDelivered, sendMail } from "@/lib/mailer";
import type { Order } from "@/types/domain";

export async function sendOrderConfirmationEmail(input: {
  to: string;
  order: Order;
}): Promise<void> {
  const { to, order } = input;
  const base = publicConfig.siteUrl.replace(/\/$/, "");
  const trackingUrl = `${base}${routes.tracking}?ref=${encodeURIComponent(order.reference)}`;

  const linesHtml = order.lines
    .map(
      (line) =>
        `<tr>
          <td style="padding:10px 0;border-bottom:1px solid #eee;color:#333;font-size:14px">${escapeHtml(line.name)} <span style="color:#999">× ${line.quantity}</span></td>
          <td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right;font-size:14px;white-space:nowrap">${escapeHtml(formatPrice(line.unitPrice * line.quantity, order.currency))}</td>
        </tr>`,
    )
    .join("");

  const body = `
    ${emailHeading("Commande confirmée")}
    ${emailParagraph(`Merci pour votre achat sur ${publicConfig.siteName}. Votre paiement a bien été reçu.`)}
    ${emailParagraph(`<strong>Référence :</strong> ${escapeHtml(order.reference)}`)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0">
      <thead>
        <tr>
          <th align="left" style="padding:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#999">Article</th>
          <th align="right" style="padding:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#999">Montant</th>
        </tr>
      </thead>
      <tbody>
        ${linesHtml}
        <tr>
          <td style="padding:14px 0 0;font-size:15px;font-weight:700">Total</td>
          <td style="padding:14px 0 0;text-align:right;font-size:15px;font-weight:700">${escapeHtml(formatPrice(order.total, order.currency))}</td>
        </tr>
      </tbody>
    </table>
    ${emailButton(trackingUrl, "Suivre ma commande")}
    ${emailParagraph("Votre colis est en cours de préparation. Le numéro de suivi sera disponible prochainement — vous recevrez un email dès l'expédition.")}
    ${emailParagraph("Conservez cette référence pour suivre l'avancement de votre commande.")}
  `;

  const text = [
    `Commande confirmée — ${order.reference}`,
    "",
    "Articles :",
    ...order.lines.map(
      (l) =>
        `- ${l.name} × ${l.quantity} : ${formatPrice(l.unitPrice * l.quantity, order.currency)}`,
    ),
    "",
    `Total : ${formatPrice(order.total, order.currency)}`,
    "",
    `Suivre la commande : ${trackingUrl}`,
    "",
    "Votre colis est en cours de préparation. Vous recevrez un email avec le numéro de suivi dès l'expédition.",
  ].join("\n");

  const result = await sendMail({
    to,
    subject: `Commande confirmée — ${order.reference}`,
    html: emailLayout(body),
    text,
  });
  assertMailDelivered(result, `confirmation client → ${to}`);
}

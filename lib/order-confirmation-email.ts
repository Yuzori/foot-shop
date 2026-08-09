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
import { formatPrice } from "@/lib/format";
import { assertMailDelivered, sendMail } from "@/lib/mailer";
import type { Order } from "@/types/domain";

export async function sendOrderConfirmationEmail(input: {
  to: string;
  order: Order;
  firstName?: string;
  firstOrderPromo?: { code: string; percent: number };
}): Promise<void> {
  const { to, order, firstName, firstOrderPromo } = input;
  const base = getSiteUrl();
  const trackingUrl = `${base}${routes.tracking}?ref=${encodeURIComponent(order.reference)}`;
  const greeting = firstName?.trim() ? `Bonjour ${escapeHtml(firstName)},` : "Bonjour,";

  const linesHtml = order.lines
    .map(
      (line) =>
        `<tr>
          <td style="padding:10px 0;border-bottom:1px solid #eee;color:#333;font-size:14px">${escapeHtml(line.name)} <span style="color:#999">× ${line.quantity}</span></td>
          <td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right;font-size:14px;white-space:nowrap">${escapeHtml(formatPrice(line.unitPrice * line.quantity, order.currency))}</td>
        </tr>`,
    )
    .join("");

  const promoBlock = firstOrderPromo
    ? `
    ${emailParagraph(`Pour vous remercier, profitez de <strong>${firstOrderPromo.percent} %</strong> sur votre prochaine commande avec le code ci-dessous :`)}
    <p style="margin:16px 0;padding:14px 18px;border-radius:12px;background:#f0f9ff;border:1px dashed #66BAFF;font-size:17px;font-weight:700;letter-spacing:0.12em;text-align:center;color:#0a0a0a">${escapeHtml(firstOrderPromo.code)}</p>
    ${emailParagraph("Saisissez ce code au paiement lors de votre prochain achat.")}
  `
    : "";

  const body = `
    ${emailHeading(firstOrderPromo ? "Merci pour votre commande" : "Commande confirmée")}
    ${emailParagraph(`${greeting}`)}
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
    ${promoBlock}
    ${emailButton(trackingUrl, "Suivre ma commande")}
    ${emailParagraph("Vous recevrez sous 48 h un email dédié au suivi de préparation, puis le numéro de suivi dès l'expédition.")}
    ${emailParagraph("Conservez cette référence pour suivre l'avancement de votre commande.")}
  `;

  const subject = firstOrderPromo
    ? `Merci pour votre commande — ${order.reference}`
    : `Commande confirmée — ${order.reference}`;

  const text = [
    subject,
    "",
    "Articles :",
    ...order.lines.map(
      (l) =>
        `- ${l.name} × ${l.quantity} : ${formatPrice(l.unitPrice * l.quantity, order.currency)}`,
    ),
    "",
    `Total : ${formatPrice(order.total, order.currency)}`,
    firstOrderPromo
      ? `Code promo prochaine commande : ${firstOrderPromo.code} (${firstOrderPromo.percent} %)`
      : "",
    "",
    `Suivre la commande : ${trackingUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  const result = await sendMail({
    to,
    subject,
    html: emailLayout(body),
    text,
  });
  assertMailDelivered(result, `confirmation client → ${to}`);
}

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
import { formatPrice } from "@/lib/format";
import type { OrderArchiveRecord } from "@/lib/order-archive-store";
import {
  buildOrderEmailLines,
  formatShippingAddressHtml,
  formatShippingAddressText,
} from "@/lib/order-email-lines";
import { assertMailDelivered, sendMail } from "@/lib/mailer";
import type { Order } from "@/types/domain";

export async function sendOrderConfirmationEmail(input: {
  to: string;
  order: Order;
  archive?: OrderArchiveRecord | null;
  firstName?: string;
  firstOrderPromo?: { code: string; percent: number };
}): Promise<void> {
  const { to, order, archive, firstName, firstOrderPromo } = input;
  const base = getSiteUrl();
  const trackingUrl = `${base}${routes.tracking}?ref=${encodeURIComponent(order.reference)}`;
  const contactUrl = `${base}${routes.contact}`;
  const greeting = firstName?.trim() ? `Bonjour ${escapeHtml(firstName)},` : "Bonjour,";

  const emailLines = buildOrderEmailLines({ archive, order });
  const currency = archive?.currency ?? order.currency;
  const shippingFee = archive?.shippingFee ?? 0;
  const promoDiscount = archive?.promoDiscount ?? 0;
  const promoCode = archive?.promoCode?.trim();
  const orderTotal = archive?.total ?? order.total;

  const linesHtml = emailLines
    .map(
      (line) =>
        `<tr>
          <td style="padding:10px 0;border-bottom:1px solid #eee;color:#333;font-size:14px">
            ${escapeHtml(line.label)}
            ${line.detail ? `<br/><span style="color:#999;font-size:12px">${escapeHtml(line.detail)}</span>` : ""}
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right;font-size:14px;white-space:nowrap">${escapeHtml(formatPrice(line.amount, currency))}</td>
        </tr>`,
    )
    .join("");

  const shippingRow =
    shippingFee > 0
      ? `<tr>
          <td style="padding:8px 0;color:#666;font-size:14px">Livraison</td>
          <td style="padding:8px 0;text-align:right;font-size:14px">${escapeHtml(formatPrice(shippingFee, currency))}</td>
        </tr>`
      : archive
        ? `<tr>
            <td style="padding:8px 0;color:#666;font-size:14px">Livraison</td>
            <td style="padding:8px 0;text-align:right;font-size:14px;color:#1a7f37">Offerte</td>
          </tr>`
        : "";

  const promoRow =
    promoDiscount > 0
      ? `<tr>
          <td style="padding:8px 0;color:#666;font-size:14px">Code promo${promoCode ? ` (${escapeHtml(promoCode)})` : ""}</td>
          <td style="padding:8px 0;text-align:right;font-size:14px;color:#1a7f37">−${escapeHtml(formatPrice(promoDiscount, currency))}</td>
        </tr>`
      : "";

  const addressBlock = archive
    ? `
    <div style="margin:20px 0;padding:16px;border-radius:12px;background:#f8f8f8;border:1px solid #eee">
      <p style="margin:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#999">Adresse de livraison</p>
      <p style="margin:0;font-size:14px;line-height:1.6;color:#333">${formatShippingAddressHtml(archive)}</p>
    </div>
  `
    : "";

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
    <div style="margin:16px 0;padding:14px 16px;border-radius:12px;background:#f0f9ff;border:1px solid #cce8ff">
      <p style="margin:0;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#666">Numéro de commande</p>
      <p style="margin:6px 0 0;font-size:20px;font-weight:700;letter-spacing:0.06em;color:#0a0a0a">${escapeHtml(order.reference)}</p>
      <p style="margin:8px 0 0;font-size:13px;color:#666">À utiliser sur la page Suivi de commande.</p>
    </div>
    ${addressBlock}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0">
      <thead>
        <tr>
          <th align="left" style="padding:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#999">Article</th>
          <th align="right" style="padding:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#999">Montant</th>
        </tr>
      </thead>
      <tbody>
        ${linesHtml}
        ${shippingRow}
        ${promoRow}
        <tr>
          <td style="padding:14px 0 0;font-size:15px;font-weight:700">Total</td>
          <td style="padding:14px 0 0;text-align:right;font-size:15px;font-weight:700">${escapeHtml(formatPrice(orderTotal, currency))}</td>
        </tr>
      </tbody>
    </table>
    ${promoBlock}
    ${emailButton(trackingUrl, "Suivre ma commande")}
    ${emailParagraph("Comptez <strong>2 à 7 jours ouvrés</strong> pour recevoir par email le <strong>lien de suivi Chronopost</strong> dès l'expédition de votre colis.")}
    ${emailParagraph("Conservez ce numéro de commande pour suivre l'avancement de votre livraison.")}
    ${emailOrderSupportBlock(contactUrl)}
  `;

  const subject = firstOrderPromo
    ? `Merci pour votre commande - ${order.reference}`
    : `Commande confirmée - ${order.reference}`;

  const text = [
    subject,
    "",
    `Numéro de commande : ${order.reference}`,
    "",
    archive ? `Adresse de livraison :\n${formatShippingAddressText(archive)}` : "",
    "",
    "Articles :",
    ...emailLines.map((line) => {
      const detail = line.detail ? ` (${line.detail})` : "";
      return `- ${line.label}${detail} : ${formatPrice(line.amount, currency)}`;
    }),
    "",
    shippingFee > 0 ? `Livraison : ${formatPrice(shippingFee, currency)}` : archive ? "Livraison : Offerte" : "",
    promoDiscount > 0
      ? `Code promo${promoCode ? ` ${promoCode}` : ""} : -${formatPrice(promoDiscount, currency)}`
      : "",
    "",
    `Total : ${formatPrice(orderTotal, currency)}`,
    firstOrderPromo
      ? `Code promo prochaine commande : ${firstOrderPromo.code} (${firstOrderPromo.percent} %)`
      : "",
    "",
    `Comptez 2 à 7 jours ouvrés pour recevoir par email le lien de suivi Chronopost.`,
    "",
    `Suivre la commande : ${trackingUrl}`,
    "",
    orderSupportNoticeText(contactUrl),
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

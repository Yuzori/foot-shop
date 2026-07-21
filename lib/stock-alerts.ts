import "server-only";

import { publicConfig } from "@/config";
import { resolveEmailProductImageUrl, productCoverEmailImageUrl } from "@/lib/email-product-image-url";
import {
  emailButton,
  emailHeading,
  emailLayout,
  emailParagraph,
  emailProductImage,
  escapeHtml,
} from "@/lib/email-template";
import { sendMail, type SendMailResult } from "@/lib/mailer";
import { isStockAlertFulfilled } from "@/lib/stock-in-stock";
import {
  readStockSubscribers,
  removeStockSubscribers,
} from "@/lib/stock-subscribers";
import { getSiteUrl, productPageUrl } from "@/lib/site-url";
import { prestashop } from "@/services/prestashop";

export async function processStockAlertEmails(): Promise<number> {
  const subs = await readStockSubscribers();
  if (subs.length === 0) return 0;

  const toRemove: Array<{
    email: string;
    productId: string;
    variantId: string | null;
  }> = [];
  let sent = 0;

  for (const sub of subs) {
    const product = await prestashop.getProductById(sub.productId);
    if (!product) {
      if (process.env.NODE_ENV !== "production") {
        console.info(`[stock] skip missing product ${sub.productId}`);
      }
      continue;
    }

    if (!isStockAlertFulfilled(product, sub.variantId, sub.variantLabel)) {
      if (process.env.NODE_ENV !== "production") {
        console.info(
          `[stock] skip not in stock product=${sub.productId} variant=${sub.variantId} label=${sub.variantLabel}`,
        );
      }
      continue;
    }

    const url = productPageUrl(sub.productId);
    const label = sub.variantLabel
      ? `${sub.productName} — ${sub.variantLabel}`
      : sub.productName;
    const image = productCoverEmailImageUrl(product);

    const result = await sendMail({
      to: sub.email,
      subject: `${publicConfig.siteName} — ${label} est de retour en stock`,
      text: `Bonne nouvelle ! ${label} est disponible.\n${url}`,
      html: emailLayout(`
        ${emailHeading("De retour en stock")}
        ${emailProductImage(image, label)}
        ${emailParagraph(`<strong>${escapeHtml(label)}</strong> est à nouveau disponible sur ${escapeHtml(publicConfig.siteName)}.`)}
        ${emailButton(url, "Voir le maillot")}
      `),
    });

    if (!result.delivered) {
      if (!result.devMode) {
        console.error(
          `[stock] mail failed to=${sub.email} product=${sub.productId}`,
          result.error,
        );
      }
      continue;
    }

    toRemove.push({
      email: sub.email,
      productId: sub.productId,
      variantId: sub.variantId,
    });
    sent += 1;
  }

  if (toRemove.length) await removeStockSubscribers(toRemove);
  return sent;
}

export async function sendStockAlertConfirmation(input: {
  email: string;
  label: string;
  imageUrl?: string | null;
}): Promise<SendMailResult> {
  const base = getSiteUrl();
  const image = resolveEmailProductImageUrl({ relativeUrl: input.imageUrl });

  return sendMail({
    to: input.email,
    subject: `${publicConfig.siteName} — Alerte stock enregistrée`,
    text: `Nous vous préviendrons dès que ${input.label} sera disponible.\n${base}`,
    html: emailLayout(`
      ${emailHeading("Alerte enregistrée")}
      ${emailProductImage(image, input.label)}
      ${emailParagraph(`Vous recevrez un email dès que <strong>${escapeHtml(input.label)}</strong> sera de retour en stock.`)}
      ${emailParagraph("Un seul message quand l'article est disponible.")}
      ${emailButton(base, "Continuer vos achats")}
    `),
  });
}

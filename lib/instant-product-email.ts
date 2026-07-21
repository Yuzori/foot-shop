import "server-only";

import { publicConfig } from "@/config";
import { productCoverEmailImageUrl } from "@/lib/email-product-image-url";
import {
  emailButton,
  emailHeading,
  emailLayout,
  emailParagraph,
  emailProductImage,
  escapeHtml,
} from "@/lib/email-template";
import { readGuestNewsletterEmails } from "@/lib/newsletter-subscribers";
import { sendMail } from "@/lib/mailer";
import { productPageUrl } from "@/lib/site-url";
import { prestashop } from "@/services/prestashop";

/** Envoie immédiatement une alerte « nouveau maillot » aux abonnés newsletter. */
export async function sendInstantNewProductEmail(input: {
  productId: string;
  name: string;
  imageUrl?: string | null;
}): Promise<number> {
  const psSubs = await prestashop.getNewsletterSubscribers();
  const guestSubs = await readGuestNewsletterEmails();
  const subscribers = [...new Set([...psSubs, ...guestSubs])];
  if (!subscribers.length) return 0;

  const product = await prestashop.getProductById(input.productId);
  const url = productPageUrl(input.productId);
  const image = product ? productCoverEmailImageUrl(product) : "";

  const body = `
    ${emailHeading("Nouveau maillot disponible")}
    ${emailProductImage(image, input.name)}
    ${emailParagraph(`<strong>${escapeHtml(input.name)}</strong> vient d'arriver sur ${escapeHtml(publicConfig.siteName)}.`)}
    ${emailParagraph("Stock limité — ne ratez pas ce drop.")}
    ${emailButton(url, "Voir le maillot")}
  `;

  let sent = 0;
  for (const to of subscribers) {
    const result = await sendMail({
      to,
      subject: `${publicConfig.siteName} — Nouveau : ${input.name}`,
      html: emailLayout(body),
      text: `Nouveau maillot : ${input.name}\n${url}`,
    });
    if (result.delivered) sent += 1;
  }
  return sent;
}

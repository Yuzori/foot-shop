import "server-only";

import { NextResponse } from "next/server";

import { publicConfig } from "@/config";
import { mailConfig } from "@/config/mail";
import { productCoverEmailImageUrl } from "@/lib/email-product-image-url";
import {
  emailButton,
  emailHeading,
  emailLayout,
  emailParagraph,
  emailProductImage,
} from "@/lib/email-template";
import { readGuestNewsletterEmails } from "@/lib/newsletter-subscribers";
import { sendMail } from "@/lib/mailer";
import { getSiteUrl, productPageUrl } from "@/lib/site-url";
import { readSnapshot, writeSnapshot, type ProductSnapshot } from "@/lib/notify-state";
import { processStockAlertEmails } from "@/lib/stock-alerts";
import { filterProductsByKind } from "@/lib/product-collection";
import { prestashop } from "@/services/prestashop";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Envoie alertes nouveautés + traite les cloches stock. */
export async function runNotifyJob() {
  if (!prestashop.isConfigured) {
    return NextResponse.json({ message: "Back office non configuré." }, { status: 503 });
  }

  const result = await prestashop.getProducts({ limit: 500, page: 1 });
  const products = result.items;

  const previous = await readSnapshot();
  const isFirstRun = !previous.updatedAt;

  const newArrivals = filterProductsByKind(
    products.filter((p) => !previous.items[p.id]),
    "jersey",
  );
  const backInStock = filterProductsByKind(
    products.filter(
      (p) => previous.items[p.id] && !previous.items[p.id]!.inStock && p.inStock,
    ),
    "jersey",
  );
  const wentOutOfStock = filterProductsByKind(
    products.filter(
      (p) => previous.items[p.id] && previous.items[p.id]!.inStock && !p.inStock,
    ),
    "jersey",
  );

  const snapshot: ProductSnapshot = {
    items: Object.fromEntries(products.map((p) => [p.id, { inStock: p.inStock }])),
    updatedAt: new Date().toISOString(),
    lastEmailRunAt: previous.lastEmailRunAt ?? null,
    lastStockCheckAt: previous.lastStockCheckAt ?? null,
  };
  await writeSnapshot(snapshot);

  const stockSent = await processStockAlertEmails();

  if (isFirstRun) {
    return NextResponse.json({
      message: "État initial enregistré. Aucune alerte nouveauté envoyée.",
      tracked: products.length,
      stockAlertsSent: stockSent,
      smtp: mailConfig.enabled,
    });
  }

  if (newArrivals.length === 0 && backInStock.length === 0 && wentOutOfStock.length === 0) {
    return NextResponse.json({
      message: "Aucune nouveauté à signaler.",
      sent: 0,
      stockAlertsSent: stockSent,
      smtp: mailConfig.enabled,
    });
  }

  const psSubs = await prestashop.getNewsletterSubscribers();
  const guestSubs = await readGuestNewsletterEmails();
  const subscribers = [...new Set([...psSubs, ...guestSubs])];

  if (subscribers.length === 0) {
    return NextResponse.json({
      message: "Nouveautés détectées mais aucun abonné newsletter.",
      newArrivals: newArrivals.length,
      backInStock: backInStock.length,
      sent: 0,
      stockAlertsSent: stockSent,
    });
  }

  const base = getSiteUrl();
  const listHtml = (title: string, items: typeof products) =>
    items.length
      ? `<h3 style="margin:20px 0 8px;font-size:16px">${title}</h3>${items
          .map((p) => {
            const img = productCoverEmailImageUrl(p);
            return `<div style="margin-bottom:20px">${emailProductImage(img, p.name)}<p style="margin:0 0 6px;font-size:15px"><a href="${productPageUrl(p.id)}" style="color:#0a0a0a;font-weight:600;text-decoration:none">${escapeHtml(p.name)}</a></p></div>`;
          })
          .join("")}`
      : "";

  const body = `
    ${emailHeading("Du nouveau en boutique !")}
    ${listHtml("Nouveaux maillots", newArrivals)}
    ${listHtml("Maillots de retour en stock", backInStock)}
    ${listHtml("Dernières pièces — rupture imminente", wentOutOfStock)}
    ${emailButton(`${base}/catalogue`, "Voir la boutique")}
    ${emailParagraph(`<span style="color:#999;font-size:12px">Vous recevez cet email car vous êtes inscrit à la newsletter ${publicConfig.siteName}.</span>`)}
  `;

  const html = emailLayout(body);
  const text = [
    `Du nouveau chez ${publicConfig.siteName} !`,
    ...newArrivals.map((p) => `Nouveau maillot: ${p.name} - ${productPageUrl(p.id)}`),
    ...backInStock.map(
      (p) => `Retour en stock: ${p.name} - ${productPageUrl(p.id)}`,
    ),
    ...wentOutOfStock.map(
      (p) => `Rupture imminente: ${p.name} - ${productPageUrl(p.id)}`,
    ),
  ].join("\n");

  let delivered = 0;
  let failed = 0;
  for (const to of subscribers) {
    const mailResult = await sendMail({
      to,
      subject: `${publicConfig.siteName} — Nouveaux maillots & retours en stock`,
      html,
      text,
    });
    if (mailResult.delivered) delivered += 1;
    else failed += 1;
  }

  await writeSnapshot({
    ...snapshot,
    lastEmailRunAt: new Date().toISOString(),
  });

  return NextResponse.json({
    message: "Alertes envoyées.",
    newArrivals: newArrivals.length,
    backInStock: backInStock.length,
    sent: delivered,
    failed,
    mailProvider: mailConfig.provider,
    subscribers: subscribers.length,
    stockAlertsSent: stockSent,
    smtp: mailConfig.enabled,
  });
}

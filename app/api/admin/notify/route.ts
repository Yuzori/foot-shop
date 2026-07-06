import { NextResponse } from "next/server";

import { publicConfig } from "@/config";
import { mailConfig } from "@/config/mail";
import { isAdminAuthorized } from "@/lib/admin-auth";
import {
  emailButton,
  emailHeading,
  emailLayout,
  emailParagraph,
} from "@/lib/email-template";
import { sendMail } from "@/lib/mailer";
import { readGuestNewsletterEmails } from "@/lib/newsletter-subscribers";
import { readSnapshot, writeSnapshot, type ProductSnapshot } from "@/lib/notify-state";
import { processStockAlertEmails } from "@/lib/stock-alerts";
import { prestashop } from "@/services/prestashop";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function isAuthorized(request: Request): boolean {
  return isAdminAuthorized(request);
}

/** État SMTP (admin uniquement). */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  }
  return NextResponse.json({
    provider: mailConfig.provider,
    smtp: mailConfig.smtpEnabled,
    resend: mailConfig.resendEnabled,
    adminSecretSet: Boolean(mailConfig.adminSecret),
  });
}

/**
 * Envoie alertes nouveautés + traite les cloches stock.
 * POST avec header `x-admin-secret: <ADMIN_SECRET>`
 */
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  }
  return runNotifyJob();
}

export async function runNotifyJob() {
  if (!prestashop.isConfigured) {
    return NextResponse.json({ message: "Back office non configuré." }, { status: 503 });
  }

  const result = await prestashop.getProducts({ limit: 300, page: 1 });
  const products = result.items;

  const previous = await readSnapshot();
  const isFirstRun = !previous.updatedAt;

  const newArrivals = products.filter((p) => !previous.items[p.id]);
  const backInStock = products.filter(
    (p) => previous.items[p.id] && !previous.items[p.id]!.inStock && p.inStock,
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

  if (newArrivals.length === 0 && backInStock.length === 0) {
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

  const base = publicConfig.siteUrl.replace(/\/$/, "");
  const listHtml = (title: string, items: typeof products) =>
    items.length
      ? `<h3 style="margin:20px 0 8px;font-size:16px">${title}</h3><ul style="padding-left:18px;margin:0">${items
          .map(
            (p) =>
              `<li style="margin-bottom:6px"><a href="${base}/produit/${p.id}" style="color:#0a0a0a">${escapeHtml(p.name)}</a></li>`,
          )
          .join("")}</ul>`
      : "";

  const body = `
    ${emailHeading("Du nouveau en boutique !")}
    ${listHtml("Nouveautés", newArrivals)}
    ${listHtml("De retour en stock", backInStock)}
    ${emailButton(`${base}/catalogue`, "Voir la boutique")}
    ${emailParagraph(`<span style="color:#999;font-size:12px">Vous recevez cet email car vous êtes inscrit à la newsletter ${publicConfig.siteName}.</span>`)}
  `;

  const html = emailLayout(body);
  const text = [
    `Du nouveau chez ${publicConfig.siteName} !`,
    ...newArrivals.map((p) => `Nouveau: ${p.name} - ${base}/produit/${p.id}`),
    ...backInStock.map((p) => `De retour: ${p.name} - ${base}/produit/${p.id}`),
  ].join("\n");

  let delivered = 0;
  for (const to of subscribers) {
    const mailResult = await sendMail({
      to,
      subject: `${publicConfig.siteName} — Nouveautés & retours en stock`,
      html,
      text,
    });
    if (mailResult.delivered) delivered += 1;
  }

  return NextResponse.json({
    message: "Alertes envoyées.",
    newArrivals: newArrivals.length,
    backInStock: backInStock.length,
    sent: delivered,
    subscribers: subscribers.length,
    stockAlertsSent: stockSent,
    smtp: mailConfig.enabled,
  });
}

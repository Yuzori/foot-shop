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
import {
  filterNotifiableProducts,
  isNotifiableProduct,
} from "@/lib/product-collection";
import { resolveCatalogNavCategories } from "@/lib/resolve-catalog-nav";
import { getSiteUrl, productPageUrl } from "@/lib/site-url";
import {
  readSnapshot,
  writeSnapshot,
  isSnapshotBootstrapped,
  withNotifyJobLock,
  enqueuePopupProducts,
  type ProductSnapshot,
} from "@/lib/notify-state";
import { processStockAlertEmails } from "@/lib/stock-alerts";
import { prestashop } from "@/services/prestashop";
import type { Product } from "@/types/domain";

const RECENT_BACKFILL_MS = 7 * 24 * 60 * 60 * 1000;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function shortsCategoryIdsFromNav(
  categories: Awaited<ReturnType<typeof prestashop.getCategories>>,
): Set<string> {
  const nav = resolveCatalogNavCategories(categories);
  return new Set(
    [nav.shortsCategoryId, nav.kidsShortsCategoryId].filter(Boolean),
  );
}

function wasNotified(productId: string, previous: ProductSnapshot): boolean {
  return (previous.notifiedProductIds ?? []).includes(productId);
}

function isRecentlyCreated(product: Product): boolean {
  if (!product.createdAt) return false;
  const created = Date.parse(product.createdAt);
  if (Number.isNaN(created)) return false;
  return Date.now() - created < RECENT_BACKFILL_MS;
}

/** Nouveau produit ou publication récente jamais notifiée (ex. import « DGH »). */
function shouldNotifyProduct(
  product: Product,
  previous: ProductSnapshot,
  shortsCategoryIds: ReadonlySet<string>,
): boolean {
  if (!isNotifiableProduct(product, shortsCategoryIds)) return false;
  if (wasNotified(product.id, previous)) return false;
  if (!previous.items[product.id]) return true;
  return isRecentlyCreated(product);
}

function markNotified(
  previous: ProductSnapshot,
  productIds: string[],
): string[] {
  return [...new Set([...(previous.notifiedProductIds ?? []), ...productIds])];
}

/** Envoie alertes nouveautés + traite les cloches stock. */
export async function runNotifyJob() {
  const locked = await withNotifyJobLock(async () => runNotifyJobInner());
  if (locked === null) {
    return NextResponse.json({
      message: "Job notify déjà en cours.",
      skipped: true,
    });
  }
  return locked;
}

async function runNotifyJobInner() {
  if (!prestashop.isConfigured) {
    return NextResponse.json({ message: "Back office non configuré." }, { status: 503 });
  }

  const [result, categories] = await Promise.all([
    prestashop.getProducts({ limit: 500, page: 1 }),
    prestashop.getCategories(),
  ]);
  const products = result.items;
  const shortsCategoryIds = shortsCategoryIdsFromNav(categories);

  const previous = await readSnapshot();
  const isBootstrap = !isSnapshotBootstrapped(previous);

  const newArrivals = filterNotifiableProducts(
    products.filter((product) => shouldNotifyProduct(product, previous, shortsCategoryIds)),
    shortsCategoryIds,
  );
  const backInStock = filterNotifiableProducts(
    products.filter(
      (product) =>
        previous.items[product.id] &&
        !previous.items[product.id]!.inStock &&
        product.inStock,
    ),
    shortsCategoryIds,
  );
  const wentOutOfStock = filterNotifiableProducts(
    products.filter(
      (product) =>
        previous.items[product.id] &&
        previous.items[product.id]!.inStock &&
        !product.inStock,
    ),
    shortsCategoryIds,
  );

  const snapshot: ProductSnapshot = {
    items: Object.fromEntries(products.map((p) => [p.id, { inStock: p.inStock }])),
    updatedAt: new Date().toISOString(),
    lastEmailRunAt: previous.lastEmailRunAt ?? null,
    lastStockCheckAt: previous.lastStockCheckAt ?? null,
    popupQueue: previous.popupQueue ?? [],
    notifiedProductIds: previous.notifiedProductIds ?? [],
  };

  if (!isBootstrap && newArrivals.length > 0) {
    const ids = newArrivals.map((product) => product.id);
    await enqueuePopupProducts(ids);
    snapshot.popupQueue = [...new Set([...(snapshot.popupQueue ?? []), ...ids])];
    snapshot.notifiedProductIds = markNotified(previous, ids);
  }

  await writeSnapshot(snapshot);

  const stockSent = await processStockAlertEmails();

  if (isBootstrap) {
    return NextResponse.json({
      message: "État initial enregistré. Aucune alerte nouveauté envoyée.",
      tracked: products.length,
      stockAlertsSent: stockSent,
      smtp: mailConfig.enabled,
      bootstrap: true,
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
      popupQueued: newArrivals.map((product) => product.id),
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
    ${listHtml("Nouveaux produits", newArrivals)}
    ${listHtml("Retour en stock", backInStock)}
    ${listHtml("Dernières pièces — rupture imminente", wentOutOfStock)}
    ${emailButton(`${base}/catalogue`, "Voir la boutique")}
    ${emailParagraph(`<span style="color:#999;font-size:12px">Vous recevez cet email car vous êtes inscrit à la newsletter ${publicConfig.siteName}.</span>`)}
  `;

  const html = emailLayout(body);
  const text = [
    `Du nouveau chez ${publicConfig.siteName} !`,
    ...newArrivals.map((p) => `Nouveau produit: ${p.name} - ${productPageUrl(p.id)}`),
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
      subject: `${publicConfig.siteName} — Nouveaux produits & retours en stock`,
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
    popupQueued: newArrivals.map((product) => product.id),
  });
}

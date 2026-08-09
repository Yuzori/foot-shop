import "server-only";

import { publicConfig } from "@/config";
import { mailConfig } from "@/config/mail";
import { welcomePromo } from "@/config/promotions";
import { routes } from "@/config/site";
import {
  emailButton,
  emailHeading,
  emailLayout,
  emailParagraph,
  emailProductImage,
} from "@/lib/email-template";
import { sendFirstOrderThankYouEmail } from "@/lib/first-order-thank-you-email";
import { sendMail, type SendMailResult } from "@/lib/mailer";
import { sendOrderConfirmationEmail } from "@/lib/order-confirmation-email";
import { sendShippingNotificationEmail } from "@/lib/shipping-notification-email";
import { sendShippingPendingEmail } from "@/lib/shipping-pending-email";
import { sendStockAlertConfirmation } from "@/lib/stock-alerts";
import { getSiteUrl } from "@/lib/site-url";
import { sendWelcomePromoEmail } from "@/lib/welcome-promo-email";
import type { Order } from "@/types/domain";

export interface EmailTestResult {
  id: string;
  label: string;
  delivered: boolean;
  devMode: boolean;
  error?: string;
}

const TEST_REF = "TEST-FS-0001";
const TEST_CODE = "123456";

function sampleOrder(): Order {
  return {
    id: "1",
    reference: TEST_REF,
    status: "processing",
    statusLabel: "Paiement accepté",
    total: 51.98,
    currency: "EUR",
    createdAt: new Date().toISOString(),
    trackingNumber: null,
    trackingUrl: null,
    lines: [
      {
        productId: "1",
        name: "Maillot Brésil Domicile 2026",
        quantity: 2,
        unitPrice: 25.99,
      },
    ],
  };
}

async function runCase(
  id: string,
  label: string,
  fn: () => Promise<SendMailResult | void>,
): Promise<EmailTestResult> {
  try {
    const result = await fn();
    if (result && typeof result === "object" && "delivered" in result) {
      return {
        id,
        label,
        delivered: result.delivered,
        devMode: result.devMode,
        error: result.error,
      };
    }
    return { id, label, delivered: true, devMode: false };
  } catch (err) {
    return {
      id,
      label,
      delivered: false,
      devMode: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Envoie un exemplaire de test de chaque email transactionnel. */
export async function runAllEmailTests(
  to: string,
  options?: { delayMs?: number },
): Promise<{
  provider: string;
  enabled: boolean;
  to: string;
  results: EmailTestResult[];
  passed: number;
  failed: number;
}> {
  const delayMs = options?.delayMs ?? 600;
  const base = getSiteUrl();
  const order = sampleOrder();
  const cases: Array<{ id: string; label: string; fn: () => Promise<unknown> }> =
    [
      {
        id: "register-verify",
        label: "Inscription — code de vérification",
        fn: () =>
          sendMail({
            to,
            subject: `[TEST] ${publicConfig.siteName} — Code de vérification`,
            text: `Votre code de vérification : ${TEST_CODE}`,
            html: emailLayout(`
              ${emailHeading("Vérifiez votre email")}
              ${emailParagraph("Code de test :")}
              <p style="font-size:28px;font-weight:700;letter-spacing:6px;background:#f6f6f6;padding:16px;text-align:center;border-radius:12px;margin:16px 0">${TEST_CODE}</p>
            `),
          }),
      },
      {
        id: "welcome-promo",
        label: "Offre de bienvenue (2+1)",
        fn: () => sendWelcomePromoEmail({ to, firstName: "Jean" }),
      },
      {
        id: "forgot-password",
        label: "Mot de passe oublié",
        fn: () =>
          sendMail({
            to,
            subject: `[TEST] ${publicConfig.siteName} — Code de réinitialisation`,
            text: `Code : ${TEST_CODE}`,
            html: emailLayout(`
              ${emailHeading("Réinitialisation du mot de passe")}
              <p style="font-size:28px;font-weight:700;letter-spacing:6px;background:#f6f6f6;padding:16px;text-align:center;border-radius:12px;margin:16px 0">${TEST_CODE}</p>
            `),
          }),
      },
      {
        id: "password-changed",
        label: "Mot de passe modifié",
        fn: () =>
          sendMail({
            to,
            subject: `[TEST] ${publicConfig.siteName} — Mot de passe modifié`,
            text: "Votre mot de passe a été modifié (test).",
            html: emailLayout(`
              ${emailHeading("Mot de passe modifié")}
              ${emailParagraph("Test — votre mot de passe a bien été mis à jour.")}
            `),
          }),
      },
      {
        id: "contact",
        label: "Formulaire contact (vers boutique)",
        fn: () =>
          sendMail({
            to,
            subject: `[TEST] [Contact ${publicConfig.siteName}] Message test`,
            text: "Message de test depuis runAllEmailTests",
            html: emailLayout(`
              ${emailHeading("Nouveau message contact")}
              ${emailParagraph("Test — message simulé.")}
            `),
          }),
      },
      {
        id: "newsletter-welcome",
        label: "Bienvenue newsletter",
        fn: () =>
          sendMail({
            to,
            subject: `[TEST] ${publicConfig.siteName} — Bienvenue dans la newsletter`,
            text: "Test newsletter",
            html: emailLayout(`
              ${emailHeading("Bienvenue !")}
              ${emailParagraph("Test — inscription newsletter.")}
              ${emailButton(`${base}/catalogue`, "Découvrir la boutique")}
            `),
          }),
      },
      {
        id: "order-confirmation",
        label: "Confirmation de commande",
        fn: () => sendOrderConfirmationEmail({ to, order }),
      },
      {
        id: "shipping-pending",
        label: "Suivi Chronopost sous 2 à 7 jours ouvrés",
        fn: () =>
          sendShippingPendingEmail({
            to,
            reference: TEST_REF,
            firstName: "Jean",
          }),
      },
      {
        id: "first-order-thanks",
        label: "Merci 1ʳᵉ commande + FOOTSHOP10",
        fn: () =>
          sendFirstOrderThankYouEmail({
            to,
            reference: TEST_REF,
            firstName: "Jean",
          }),
      },
      {
        id: "supplier-bbdbuy",
        label: "Commande fournisseur BBDBuy (copie test)",
        fn: () =>
          sendMail({
            to,
            subject: `[TEST] [BBDBuy] Commande ${TEST_REF} — Foot Shop`,
            text: `Test commande fournisseur ${TEST_REF}`,
            html: emailLayout(`
              ${emailHeading(`Commande BBDBuy — ${TEST_REF}`)}
              ${emailParagraph("Test — brouillon fournisseur simulé.")}
              ${emailParagraph("<strong>Article :</strong> Maillot Brésil × 1 — Taille M")}
            `),
          }),
      },
      {
        id: "shipping-tracking",
        label: "Colis expédié + suivi",
        fn: () =>
          sendShippingNotificationEmail({
            to,
            reference: TEST_REF,
            trackingNumber: "FR123456789TEST",
            carrierUrl: "https://www.laposte.fr/outils/suivre-vos-envois",
          }),
      },
      {
        id: "stock-alert-confirm",
        label: "Alerte stock enregistrée",
        fn: () =>
          sendStockAlertConfirmation({
            email: to,
            label: "Maillot Brésil — M",
          }),
      },
      {
        id: "stock-back",
        label: "Retour en stock",
        fn: () =>
          sendMail({
            to,
            subject: `[TEST] ${publicConfig.siteName} — Maillot Brésil est de retour`,
            text: "Test retour en stock",
            html: emailLayout(`
              ${emailHeading("De retour en stock")}
              ${emailParagraph(`<strong>Maillot Brésil — M</strong> est disponible (test).`)}
              ${emailButton(`${base}${routes.product("1")}`, "Voir le maillot")}
            `),
          }),
      },
      {
        id: "instant-new-product",
        label: "Nouveau produit (instantané)",
        fn: () =>
          sendMail({
            to,
            subject: `[TEST] ${publicConfig.siteName} — Nouveau : Maillot Test`,
            html: emailLayout(`
              ${emailHeading("Nouveau maillot disponible")}
              ${emailParagraph(`<strong>Maillot Test</strong> vient d'arriver (test).`)}
              ${emailButton(`${base}${routes.catalogue}`, "Voir le maillot")}
            `),
            text: "Nouveau maillot test",
          }),
      },
      {
        id: "digest-newsletter",
        label: "Digest nouveautés & retours",
        fn: () =>
          sendMail({
            to,
            subject: `[TEST] ${publicConfig.siteName} — Nouveaux maillots & retours en stock`,
            html: emailLayout(`
              ${emailHeading("Du nouveau en boutique !")}
              ${emailParagraph("Test — digest newsletter.")}
              ${emailProductImage("", "Maillot exemple")}
              ${emailButton(`${base}/catalogue`, "Voir la boutique")}
            `),
            text: "Test digest newsletter",
          }),
      },
    ];

  if (!welcomePromo.enabled) {
    const idx = cases.findIndex((c) => c.id === "welcome-promo");
    if (idx >= 0) cases.splice(idx, 1);
  }

  const results: EmailTestResult[] = [];
  for (const testCase of cases) {
    results.push(
      await runCase(testCase.id, testCase.label, () =>
        testCase.fn() as Promise<SendMailResult | void>,
      ),
    );
    if (delayMs > 0) await sleep(delayMs);
  }

  const passed = results.filter((r) => r.delivered).length;
  const failed = results.filter((r) => !r.delivered && !r.devMode).length;

  return {
    provider: mailConfig.provider,
    enabled: mailConfig.enabled,
    to,
    results,
    passed,
    failed,
  };
}

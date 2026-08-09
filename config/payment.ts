/**
 * Payment configuration (server-only).
 *
 *   STRIPE_SECRET_KEY=sk_live_...        (ou sk_test_... pour les tests)
 *   STRIPE_WEBHOOK_SECRET=whsec_...      (donné par Stripe lors de la création du webhook)
 *
 * Le webhook à configurer dans le dashboard Stripe :
 *   URL   : https://votre-domaine.com/api/webhooks/stripe
 *   Events: payment_intent.succeeded (paiement intégré Foot Shop)
 *   Events recommandés : checkout.session.completed,
 *     checkout.session.async_payment_succeeded,
 *     checkout.session.async_payment_failed
 *
 * Côté navigateur, définir aussi NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.
 *
 * Tant que STRIPE_SECRET_KEY n'est pas défini, le checkout retombe
 * automatiquement sur la création de commande "en attente de paiement".
 */
import "server-only";

export const paymentConfig = {
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  /** Devise des paiements Stripe (doit correspondre à la boutique). */
  currency: (process.env.STRIPE_CURRENCY ?? "eur").toLowerCase(),
  /** id_order_state PrestaShop appliqué après paiement réussi (2 = Paiement accepté). */
  paidStateId: Number(process.env.PRESTASHOP_PAID_STATE_ID ?? "2"),
  get stripeEnabled(): boolean {
    return Boolean(this.stripeSecretKey);
  },
  /** Identifiant interne pour vérifier le déploiement (GET /api/checkout/stripe/config). */
  checkoutStripeVersion: "checkout-ux-v15",
  /**
   * Configuration Stripe Dashboard (pmc_…) — Apple Pay, PayPal, Link, etc.
   * https://dashboard.stripe.com/settings/payment_methods
   */
  stripePaymentMethodConfigurationId:
    process.env.STRIPE_PAYMENT_METHOD_CONFIGURATION?.trim() ?? "",
  get stripeCheckoutPaymentMethodTypes(): ("card" | "link" | "paypal")[] {
    return ["card", "link", "paypal"];
  },
} as const;

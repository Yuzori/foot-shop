/**
 * Payment configuration (server-only).
 *
 *   STRIPE_SECRET_KEY=sk_live_...        (ou sk_test_... pour les tests)
 *   STRIPE_WEBHOOK_SECRET=whsec_...      (donné par Stripe lors de la création du webhook)
 *
 * Le webhook à configurer dans le dashboard Stripe :
 *   URL   : https://votre-domaine.com/api/webhooks/stripe
 *   Events: payment_intent.succeeded (paiement intégré Foot Shop)
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
} as const;

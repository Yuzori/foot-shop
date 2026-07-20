import "server-only";



import crypto from "node:crypto";



import { formatFlocageLabel } from "@/config/shop";

import { getSession } from "@/lib/auth";
import { archiveOrder } from "@/lib/order-archive-store";
import { validatePromoCodeForCheckout } from "@/lib/validate-promo-code";
import { resolveCartLines } from "@/lib/resolve-cart-lines";
import { resolveShippingFee } from "@/lib/shipping-fee";
import { prestashop } from "@/services/prestashop";

import type { CreateOrderLine } from "@/services/prestashop";



export interface CheckoutBody {

  contact: { firstName: string; lastName: string; email: string; phone?: string };

  address: {

    address1: string;

    address2?: string;

    postcode: string;

    city: string;

    country: string;

  };

  lines: CreateOrderLine[];

  promoCode?: string;

}



export interface PlaceOrderResult {

  ok: boolean;

  status: number;

  reference?: string;

  orderId?: string | null;

  customerId?: string;

  /** Lignes recalculées côté serveur (prix PrestaShop). */
  lines?: CreateOrderLine[];

  shippingFee?: number;

  shippingLabel?: string;

  promoDiscount?: number;

  promoCode?: string | null;

  message?: string;

  detail?: string | null;

}



/** Builds a supplier-ready note from order lines (flocage, variantes). */

export function buildOrderNote(lines: CreateOrderLine[]): string {

  const parts: string[] = [];

  for (const line of lines) {

    const label = line.name ?? `Produit #${line.productId}`;

    if (line.flocage) {

      const floc =

        line.flocage.name

          ? formatFlocageLabel({

              name: line.flocage.name,

              number: line.flocage.number ?? "",

            })

          : line.flocage.text;

      if (floc) {

        parts.push(

          `${label} (x${line.quantity}) — FLOCAGE NOM="${line.flocage.name ?? floc}" NUM="${line.flocage.number ?? ""}" (+${line.flocage.price.toFixed(2)} EUR/maillot)`,

        );

      }

    }

  }

  if (parts.length === 0) return "";

  return ["=== INSTRUCTIONS FLOCAGE / FOURNISSEUR ===", ...parts].join("\n");

}



function mapPrestaShopOrderError(error: string | null): string {

  if (!error) {

    return "La commande n'a pas pu être enregistrée. Vérifiez la configuration (transporteur, devise, permissions Webservice).";

  }

  if (error.includes("no_carrier_configured")) {

    return "Aucun transporteur actif dans PrestaShop. Activez au moins un transporteur.";

  }

  if (error.includes("no_country_resolved")) {

    return "Pays de livraison introuvable dans PrestaShop.";

  }

  if (error.includes("address_failed")) {

    return "Impossible d'enregistrer l'adresse de livraison dans PrestaShop.";

  }

  if (error.includes("cart_failed")) {

    return "Impossible de créer le panier PrestaShop pour cette commande.";

  }

  if (error.includes("order_failed")) {

    return "Impossible de finaliser la commande dans PrestaShop.";

  }

  if (error.includes("secure_key")) {

    return "Clé client PrestaShop invalide. Reconnectez-vous puis réessayez.";

  }

  return "La commande n'a pas pu être enregistrée. Vérifiez la configuration (transporteur, devise, permissions Webservice).";

}



/** Refuse les lignes sans taille ou hors stock / supprimées. */
async function validateCheckoutLines(
  lines: CreateOrderLine[],
): Promise<
  { ok: true; lines: CreateOrderLine[] } | { ok: false; message: string }
> {
  return resolveCartLines(lines);
}



/**

 * Resolves the customer (session → existing email → guest creation) and creates

 * a real PrestaShop order in the "Awaiting payment" state. Shared by the direct

 * checkout and the Stripe checkout (which then marks it paid on webhook).

 */

export async function placeOrder(body: CheckoutBody): Promise<PlaceOrderResult> {

  if (!prestashop.isConfigured) {

    return { ok: false, status: 503, message: "Back office non configuré." };

  }



  const { contact, address, lines } = body ?? ({} as CheckoutBody);

  if (

    !contact?.email ||

    !address?.address1 ||

    !address?.city ||

    !address?.postcode ||

    !Array.isArray(lines) ||

    lines.length === 0

  ) {

    return { ok: false, status: 400, message: "Informations de commande incomplètes." };

  }

  const lineResult = await validateCheckoutLines(lines);
  if (!lineResult.ok) {
    return { ok: false, status: 400, message: lineResult.message };
  }
  const resolvedLines = lineResult.lines;



  const session = await getSession();

  let customerId = session?.id ? String(session.id) : null;



  if (!customerId) {

    const existing = await prestashop.getCustomerAuthByEmail(contact.email);

    if (existing) {

      customerId = existing.id;

    } else {

      const created = await prestashop.createCustomer({

        firstName: contact.firstName || "Client",

        lastName: contact.lastName || "Client",

        email: contact.email,

        password: crypto.randomUUID(),

      });

      if (!created.customer) {

        return {

          ok: false,

          status: 502,

          message:

            "Impossible de créer le compte client. Vérifiez les permissions Webservice (customers).",

          detail: created.error,

        };

      }

      customerId = created.customer.id;

    }

  }



  const secureKey = await prestashop.ensureCustomerSecureKey(customerId);

  if (!secureKey) {

    return {

      ok: false,

      status: 502,

      message:

        "Impossible de préparer le compte client pour la commande. Réessayez ou contactez le support.",

    };

  }



  const note = buildOrderNote(resolvedLines);

  const shipping = await resolveShippingFee({
    email: contact.email,
    customerId,
  });

  const subtotal = resolvedLines.reduce(
    (sum, line) => sum + line.unitPrice * line.quantity,
    0,
  );
  const promoValidation = await validatePromoCodeForCheckout({
    code: body.promoCode,
    email: contact.email,
    customerId,
    subtotal,
  });
  if (body.promoCode?.trim() && promoValidation && !promoValidation.valid) {
    return {
      ok: false,
      status: 400,
      message: promoValidation.message,
    };
  }
  const promo =
    promoValidation?.valid === true
      ? {
          valid: true as const,
          code: promoValidation.code,
          percent: promoValidation.percent,
          label: promoValidation.label,
        }
      : null;
  const promoDiscount =
    promoValidation?.valid === true ? promoValidation.discount : 0;

  const result = await prestashop.createOrder({

    customerId,

    secureKey,

    contact,

    address,

    lines: resolvedLines,

    note,

    shippingFee: shipping.fee,

  });



  if (!result.reference) {

    console.error("[placeOrder] failed", result.error);

    return {

      ok: false,

      status: 502,

      message: mapPrestaShopOrderError(result.error),

      detail: result.error,

    };

  }



  const archiveId = `ord-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const total = Math.max(0, subtotal - promoDiscount + shipping.fee);

  await archiveOrder({
    id: archiveId,
    reference: result.reference ?? archiveId,
    orderId: result.orderId,
    customerId,
    createdAt: new Date().toISOString(),
    paidAt: null,
    status: "created",
    contact,
    address,
    lines: resolvedLines,
    subtotal,
    shippingFee: shipping.fee,
    promoCode: promo?.valid ? promo.code : null,
    promoDiscount,
    total,
    currency: "EUR",
    note: note || undefined,
    source: "checkout",
  }).catch((err) => {
    console.error("[placeOrder] archive failed", err);
  });

  return {

    ok: true,

    status: 200,

    reference: result.reference,

    orderId: result.orderId,

    customerId,

    lines: resolvedLines,

    shippingFee: shipping.fee,

    shippingLabel: shipping.label,

    promoDiscount,

    promoCode: promo?.valid ? promo.code : null,

  };

}



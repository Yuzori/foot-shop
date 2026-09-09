import { formatFlocageLabel } from "@/config/shop";
import { paymentConfig } from "@/config/payment";
import { flocageTestPromo } from "@/config/promotions";
import type { OrderLineForMetadata } from "@/lib/stripe-order-metadata";
import type { CreateOrderLine } from "@/services/prestashop";

type StripeLineItem = {
  quantity: number;
  price_data: {
    currency: string;
    unit_amount: number;
    product_data: {
      name: string;
      description?: string;
    };
  };
};

function flocageLineName(line: CreateOrderLine): string {
  if (!line.flocage) return "Flocage personnalisé";
  if (line.flocage.name?.trim()) {
    return `Flocage : ${formatFlocageLabel({
      name: line.flocage.name,
      number: line.flocage.number ?? "",
    })}`;
  }
  return `Flocage : ${line.flocage.text?.trim() || "personnalisé"}`;
}

/** Lignes Stripe : produit et flocage séparés (prix visibles dans le dashboard). */
export function buildStripeCheckoutLineItems(input: {
  serverLines: CreateOrderLine[];
  bodyLines: OrderLineForMetadata[];
  shippingFee: number;
  promoDiscount: number;
  promoCode: string | null;
  reference: string;
}): StripeLineItem[] {
  const items: StripeLineItem[] = [];

  for (let index = 0; index < input.serverLines.length; index++) {
    const line = input.serverLines[index]!;
    const flocageUnit = line.flocage?.price ?? 0;
    const productUnit = Math.max(0, line.unitPrice - flocageUnit);
    const optionsLabel = input.bodyLines[index]?.optionsLabel;

    const sizePart = optionsLabel?.replace(/^taille:\s*/i, "").trim();
    const productDescription = [
      `Réf. ${input.reference}`,
      sizePart ? `Taille: ${sizePart}` : "",
    ]
      .filter(Boolean)
      .join(" · ");

    items.push({
      quantity: line.quantity,
      price_data: {
        currency: paymentConfig.currency,
        unit_amount: Math.round(productUnit * 100),
        product_data: {
          name: line.name || "Article",
          ...(productDescription ? { description: productDescription.slice(0, 500) } : {}),
        },
      },
    });

    if (line.flocage && flocageUnit > 0) {
      items.push({
        quantity: line.quantity,
        price_data: {
          currency: paymentConfig.currency,
          unit_amount: Math.max(50, Math.round(flocageUnit * 100)),
          product_data: {
            name: flocageLineName(line),
            description: `Réf. ${input.reference}`,
          },
        },
      });
    }
  }

  if (input.shippingFee > 0) {
    items.push({
      quantity: 1,
      price_data: {
        currency: paymentConfig.currency,
        unit_amount: Math.round(input.shippingFee * 100),
        product_data: {
          name: "Livraison",
          description: `Réf. ${input.reference}`,
        },
      },
    });
  }

  const skipPercentPromoOnStripe =
    input.promoCode === flocageTestPromo.code || !input.promoCode;

  if (input.promoDiscount > 0 && input.promoCode && !skipPercentPromoOnStripe) {
    const productItems = items.filter((item) => item.price_data.product_data.name !== "Livraison");
    const subtotal = productItems.reduce(
      (sum, item) => sum + (item.price_data.unit_amount * item.quantity) / 100,
      0,
    );
    let remaining = input.promoDiscount;

    for (let i = 0; i < productItems.length; i++) {
      const item = productItems[i]!;
      const lineTotal = (item.price_data.unit_amount * item.quantity) / 100;
      const share =
        i === productItems.length - 1
          ? remaining
          : Math.round(((input.promoDiscount * lineTotal) / subtotal) * 100) / 100;
      remaining -= share;
      if (share <= 0) continue;

      const newTotal = Math.max(0.5, lineTotal - share);
      item.price_data.unit_amount = Math.round((newTotal / item.quantity) * 100);
      item.price_data.product_data.name = `${item.price_data.product_data.name} (${input.promoCode})`;
    }
  }

  return items;
}

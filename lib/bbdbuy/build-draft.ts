import "server-only";

import {
  loadSupplierCatalog,
  resolveSupplierLine,
} from "@/lib/supplier-catalog";
import type { BbdBuyOrderDraft, SupplierOrderContext } from "@/lib/bbdbuy/types";
import { prestashop } from "@/services/prestashop";

const BBDBUY_CHECKLIST = [
  "Ouvrir bbdbuy.com et se connecter",
  "Pour chaque article : rechercher le maillot (lien Taobao si fourni, sinon nom + taille)",
  "Choisir taille et quantité indiquées",
  "Ajouter une note flocage dans les remarques si présent",
  "Payer côté BBDBuy et valider les photos QC",
  "Créer le colis vers l'adresse client (ou entrepôt si vous consolidez)",
  "Une fois expédié : saisir le numéro de suivi dans PrestaShop (commande → transport)",
] as const;

function extractSizeFromName(name: string): string | null {
  const match = name.match(/\b(XXS|XS|S|M|L|XL|XXL|2XL|3XL)\b/i);
  return match?.[1]?.toUpperCase() ?? null;
}

async function resolveProductImage(productId: string): Promise<string | null> {
  const product = await prestashop.getProductById(productId);
  return product?.cover?.url ?? null;
}

export async function buildBbdBuyOrderDraft(
  context: SupplierOrderContext,
): Promise<BbdBuyOrderDraft> {
  const catalog = await loadSupplierCatalog();
  const imageCache = new Map<string, string | null>();

  const lines = await Promise.all(
    context.lines.map(async (line) => {
      const mapping = resolveSupplierLine(
        catalog,
        line.productId,
        line.variantId,
      );
      const size = mapping.size ?? extractSizeFromName(line.name) ?? null;

      let imageUrl = imageCache.get(line.productId);
      if (imageUrl === undefined) {
        imageUrl = await resolveProductImage(line.productId);
        imageCache.set(line.productId, imageUrl);
      }

      return {
        productId: line.productId,
        variantId: line.variantId,
        name: line.name,
        quantity: line.quantity,
        size,
        imageUrl,
        supplierUrl: mapping.supplierUrl,
        supplierLabel: mapping.label,
        supplierNotes: mapping.notes,
        missingCatalog: !mapping.supplierUrl,
      };
    }),
  );

  return {
    orderId: context.orderId,
    reference: context.reference,
    createdAt: new Date().toISOString(),
    status: "pending",
    customer: {
      firstName: context.delivery.firstName,
      lastName: context.delivery.lastName,
      phone: context.delivery.phone,
      email: context.customerEmail,
    },
    shipping: {
      address1: context.delivery.address1,
      address2: context.delivery.address2,
      postcode: context.delivery.postcode,
      city: context.delivery.city,
      country: context.delivery.country,
    },
    flocageNote: context.flocageNote,
    lines,
    checklist: [...BBDBUY_CHECKLIST],
  };
}

import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

export interface SupplierVariantMapping {
  size?: string;
  supplierSku?: string;
  supplierUrl?: string;
}

export interface SupplierProductMapping {
  supplierUrl: string;
  label?: string;
  supplierNotes?: string;
  variants?: Record<string, SupplierVariantMapping>;
}

export interface SupplierCatalog {
  products: Record<string, SupplierProductMapping>;
}

const CATALOG_PATHS = [
  path.join(process.cwd(), ".data", "supplier-catalog.json"),
  path.join(process.cwd(), "supplier-catalog.json"),
];

let cached: SupplierCatalog | null = null;

export async function loadSupplierCatalog(): Promise<SupplierCatalog> {
  if (cached) return cached;

  for (const filePath of CATALOG_PATHS) {
    try {
      const raw = await fs.readFile(filePath, "utf8");
      const data = JSON.parse(raw) as SupplierCatalog;
      cached = { products: data.products ?? {} };
      return cached;
    } catch {
      /* try next path */
    }
  }

  cached = { products: {} };
  return cached;
}

export function resolveSupplierLine(
  catalog: SupplierCatalog,
  productId: string,
  variantId: string | null,
): {
  supplierUrl: string | null;
  size: string | null;
  label: string | null;
  notes: string | null;
} {
  const product = catalog.products[productId];
  if (!product) {
    return { supplierUrl: null, size: null, label: null, notes: null };
  }

  const variantKey = variantId ?? "0";
  const variant = product.variants?.[variantKey] ?? product.variants?.["0"];

  return {
    supplierUrl: variant?.supplierUrl ?? product.supplierUrl ?? null,
    size: variant?.size ?? null,
    label: product.label ?? null,
    notes: product.supplierNotes ?? null,
  };
}

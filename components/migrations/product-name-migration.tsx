import { ensureProductNamesNormalized } from "@/lib/migrations/normalize-product-names";

/** Lance la migration des noms maillots en arrière-plan (une seule fois). */
export async function ProductNameMigration() {
  void ensureProductNamesNormalized();
  return null;
}

import type { CartLine } from "@/types/domain";
import { shopConfig } from "@/config/shop";
import { isJerseyProduct } from "@/lib/product-collection";

export function flocageFieldValues(f?: CartLine["flocage"]) {
  const name = f?.name?.trim() ?? "";
  const number = f?.number?.trim() ?? f?.text?.trim() ?? "";
  return { name, number };
}

export function isFlocageDraftValid(name: string, number: string): boolean {
  const n = name.trim();
  const num = number.trim();
  return (
    n.length >= 2 &&
    n.length <= shopConfig.flocageNameMax &&
    num.length >= shopConfig.flocageNumberMin &&
    num.length <= shopConfig.flocageNumberMax
  );
}

/** Flocage enregistré et complet (après validation explicite). */
export function isFlocageComplete(line: CartLine): boolean {
  if (!line.flocage?.enabled) return false;
  const { name, number } = flocageFieldValues(line.flocage);
  return isFlocageDraftValid(name, number);
}

/** Maillot sans flocage complet — affiché au checkout pour saisie. */
export function lineNeedsCheckoutFlocage(line: CartLine): boolean {
  if (!isJerseyProduct(line.name)) return false;
  return !isFlocageComplete(line);
}

/** Vérifie que chaque flocage activé a nom + numéro renseignés. */
export function getFlocageValidationError(lines: CartLine[]): string | null {
  for (const line of lines) {
    if (!line.flocage?.enabled) continue;

    const { name, number } = flocageFieldValues(line.flocage);

    if (!isFlocageDraftValid(name, number)) {
      return `Complétez le nom et le numéro de flocage pour « ${line.name} » (min. ${shopConfig.flocageNumberMin} chiffres).`;
    }
  }
  return null;
}

export function isFlocageValid(lines: CartLine[]): boolean {
  return getFlocageValidationError(lines) === null;
}

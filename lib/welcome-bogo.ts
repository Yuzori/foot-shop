export interface BogoLine {
  name: string;
  /** Prix unitaire total (produit + flocage). */
  unitPrice: number;
  quantity: number;
  /** Part produit seule (hors flocage). Si absent : unitPrice − flocageUnitPrice. */
  productUnitPrice?: number;
  /** Part flocage unitaire (toujours facturée, même sur un maillot offert). */
  flocageUnitPrice?: number;
}

export interface WelcomeBogoResult {
  /** Lignes ajustées pour Stripe (prix répartis). */
  adjustedLines: BogoLine[];
  discountTotal: number;
  freeUnits: number;
  applied: boolean;
  paidUnits: number;
  totalUnits: number;
}

type BogoUnit = { productPrice: number; flocagePrice: number; lineIndex: number };

function lineProductPrice(line: BogoLine): number {
  const flocage = line.flocageUnitPrice ?? 0;
  if (line.productUnitPrice != null) {
    return line.productUnitPrice;
  }
  return Math.round((line.unitPrice - flocage) * 100) / 100;
}

function lineFlocagePrice(line: BogoLine): number {
  return line.flocageUnitPrice ?? 0;
}

/** Panier : produit et flocage sont stockés séparément. */
export function bogoLineFromCart(line: {
  name: string;
  unitPrice: number;
  quantity: number;
  flocage?: { enabled?: boolean; price?: number } | null;
}): BogoLine {
  const flocageUnitPrice =
    line.flocage?.enabled && line.flocage.price ? line.flocage.price : 0;
  const productUnitPrice = line.unitPrice;
  return {
    name: line.name,
    unitPrice: productUnitPrice + flocageUnitPrice,
    productUnitPrice,
    flocageUnitPrice,
    quantity: line.quantity,
  };
}

/** Commande serveur : unitPrice inclut déjà le flocage. */
export function bogoLineFromOrder(line: {
  name?: string;
  unitPrice: number;
  quantity: number;
  flocage?: { price?: number } | null;
}): BogoLine {
  const flocageUnitPrice = line.flocage?.price ?? 0;
  const productUnitPrice =
    Math.round((line.unitPrice - flocageUnitPrice) * 100) / 100;
  return {
    name: line.name ?? "",
    unitPrice: line.unitPrice,
    productUnitPrice,
    flocageUnitPrice,
    quantity: line.quantity,
  };
}

/** Unités dans l'ordre du panier (dernier ajouté en dernier). */
function expandBogoUnits(lines: readonly BogoLine[]): BogoUnit[] {
  const units: BogoUnit[] = [];
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    if (!line) continue;
    const productPrice = lineProductPrice(line);
    const flocagePrice = lineFlocagePrice(line);
    for (let q = 0; q < line.quantity; q++) {
      units.push({ productPrice, flocagePrice, lineIndex });
    }
  }
  return units;
}

/** 2 achetés, 1 offert : le maillot le moins cher est offert ; le flocage reste payant. */
export function calculateWelcomeBogo(
  lines: readonly BogoLine[],
): WelcomeBogoResult {
  const totalUnits = lines.reduce((sum, line) => sum + line.quantity, 0);
  const paidUnits = totalUnits;

  if (totalUnits < 3) {
    return {
      adjustedLines: lines.map((line) => ({ ...line })),
      discountTotal: 0,
      freeUnits: 0,
      applied: false,
      paidUnits,
      totalUnits,
    };
  }

  const freePerLine = allocateBogoFreeQuantities(lines);
  const freeUnits = freePerLine.reduce((sum, qty) => sum + qty, 0);

  const discountTotal =
    Math.round(
      lines.reduce((sum, line, index) => {
        const freeQty = freePerLine[index] ?? 0;
        return sum + lineProductPrice(line) * freeQty;
      }, 0) * 100,
    ) / 100;

  const subtotal =
    Math.round(
      lines.reduce(
        (sum, line) =>
          sum +
          (lineProductPrice(line) + lineFlocagePrice(line)) * line.quantity,
        0,
      ) * 100,
    ) / 100;

  if (discountTotal <= 0 || subtotal <= 0 || freeUnits <= 0) {
    return {
      adjustedLines: lines.map((line) => ({ ...line })),
      discountTotal: 0,
      freeUnits: 0,
      applied: false,
      paidUnits,
      totalUnits,
    };
  }

  const adjustedLines = lines.map((line, index) => {
    const freeQty = freePerLine[index] ?? 0;
    const qty = line.quantity;
    const productPrice = lineProductPrice(line);
    const flocagePrice = lineFlocagePrice(line);
    const paidProductRatio = qty > 0 ? (qty - freeQty) / qty : 1;
    const unitPrice =
      Math.round((productPrice * paidProductRatio + flocagePrice) * 100) / 100;

    return {
      name: line.name,
      unitPrice,
      quantity: qty,
      productUnitPrice: productPrice,
      flocageUnitPrice: flocagePrice,
    };
  });

  return {
    adjustedLines,
    discountTotal,
    freeUnits,
    applied: true,
    paidUnits,
    totalUnits,
  };
}

/** Nombre d'unités offertes par ligne (maillots les moins chers, hors flocage). */
export function allocateBogoFreeQuantities(
  lines: readonly BogoLine[],
): number[] {
  const freePerLine = lines.map(() => 0);
  const units = expandBogoUnits(lines);
  if (units.length < 3) return freePerLine;

  const freeUnits = Math.floor(units.length / 3);
  const freeSet = [...units]
    .sort((a, b) => a.productPrice - b.productPrice)
    .slice(0, freeUnits);
  for (const unit of freeSet) {
    const idx = unit.lineIndex;
    freePerLine[idx] = (freePerLine[idx] ?? 0) + 1;
  }

  return freePerLine;
}

export function unitsUntilWelcomeBogo(totalUnits: number): number {
  const remainder = totalUnits % 3;
  return remainder === 0 ? 0 : 3 - remainder;
}

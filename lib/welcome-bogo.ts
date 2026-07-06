export interface BogoLine {
  name: string;
  unitPrice: number;
  quantity: number;
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

type BogoUnit = { price: number; lineIndex: number };

/** Unités dans l'ordre du panier (dernier ajouté en dernier). */
function expandBogoUnits(lines: readonly BogoLine[]): BogoUnit[] {
  const units: BogoUnit[] = [];
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    for (let q = 0; q < line.quantity; q++) {
      units.push({ price: line.unitPrice, lineIndex });
    }
  }
  return units;
}

/** 2 achetés, 1 offert : le(s) dernier(s) article(s) ajouté(s) offert(s). */
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

  const units = expandBogoUnits(lines);
  const freeUnits = Math.floor(units.length / 3);
  const freeSet = units.slice(units.length - freeUnits);
  const discountTotal =
    Math.round(freeSet.reduce((sum, unit) => sum + unit.price, 0) * 100) / 100;

  const subtotal =
    Math.round(
      lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0) * 100,
    ) / 100;

  if (discountTotal <= 0 || subtotal <= 0) {
    return {
      adjustedLines: lines.map((line) => ({ ...line })),
      discountTotal: 0,
      freeUnits: 0,
      applied: false,
      paidUnits,
      totalUnits,
    };
  }

  const ratio = (subtotal - discountTotal) / subtotal;
  const adjustedLines = lines.map((line) => ({
    name: line.name,
    unitPrice: Math.round(line.unitPrice * ratio * 100) / 100,
    quantity: line.quantity,
  }));

  return {
    adjustedLines,
    discountTotal,
    freeUnits,
    applied: true,
    paidUnits,
    totalUnits,
  };
}

/** Nombre d'unités offertes par ligne (derniers articles du panier). */
export function allocateBogoFreeQuantities(
  lines: readonly BogoLine[],
): number[] {
  const freePerLine = lines.map(() => 0);
  const units = expandBogoUnits(lines);
  if (units.length < 3) return freePerLine;

  const freeUnits = Math.floor(units.length / 3);
  const freeSet = units.slice(units.length - freeUnits);
  for (const unit of freeSet) {
    freePerLine[unit.lineIndex]++;
  }

  return freePerLine;
}

export function unitsUntilWelcomeBogo(totalUnits: number): number {
  const remainder = totalUnits % 3;
  return remainder === 0 ? 0 : 3 - remainder;
}

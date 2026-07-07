import { NextResponse } from "next/server";

import { maybeProcessStockAlerts } from "@/lib/stock-notify";
import { prestashop } from "@/services/prestashop";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const product = await prestashop.getProductById(id);

  if (!product) {
    return NextResponse.json({ message: "Produit introuvable" }, { status: 404 });
  }

  void maybeProcessStockAlerts().catch((err) => {
    console.error("[stock] background processing failed", err);
  });

  return NextResponse.json(product);
}



import { NextResponse } from "next/server";

import { mailConfig } from "@/config/mail";
import { isStockAlertFulfilled } from "@/lib/stock-in-stock";
import { sendStockAlertConfirmation } from "@/lib/stock-alerts";
import { addStockSubscriber } from "@/lib/stock-subscribers";
import { prestashop } from "@/services/prestashop";

function normalizeVariantId(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  return String(value).trim() || null;
}

export async function POST(request: Request) {
  try {
    if (!prestashop.isConfigured) {
      return NextResponse.json({ message: "Service indisponible." }, { status: 503 });
    }

    let body: {
      email?: string;
      productId?: string;
      variantId?: unknown;
      productName?: string;
      variantLabel?: string | null;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "Requête invalide." }, { status: 400 });
    }

    const email = (body.email ?? "").trim().toLowerCase();
    const productId = String(body.productId ?? "").trim();
    const variantId = normalizeVariantId(body.variantId);
    const productName = (body.productName ?? "").trim() || "Maillot";
    const variantLabel = body.variantLabel?.trim() || null;

    if (!email || !productId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ message: "Email et produit requis." }, { status: 422 });
    }

    const product = await prestashop.getProductById(productId);
    if (!product) {
      return NextResponse.json({ message: "Produit introuvable." }, { status: 404 });
    }

    if (isStockAlertFulfilled(product, variantId, variantLabel)) {
      return NextResponse.json({
        message: "Ce produit est déjà en stock !",
        alreadyInStock: true,
      });
    }

    const label = variantLabel
      ? `${product.name || productName} — ${variantLabel}`
      : product.name || productName;

    const imageUrl = product.cover?.url ?? null;

    const { added } = await addStockSubscriber({
      email,
      productId,
      variantId,
      productName: product.name || productName,
      variantLabel,
      imageUrl,
    });

    if (!added) {
      return NextResponse.json({
        message: "Vous êtes déjà inscrit pour cette alerte.",
        subscribed: true,
      });
    }

    try {
      await sendStockAlertConfirmation({ email, label, imageUrl });
    } catch (mailErr) {
      console.error("[stock-alert] confirmation email failed:", mailErr);
    }

    const smtpHint = mailConfig.enabled
      ? ""
      : " (SMTP non configuré — configurez .env.local pour recevoir les emails.)";

    return NextResponse.json({
      message: `Alerte enregistrée. Vous recevrez un email dès que l'article sera disponible.${smtpHint}`,
      subscribed: true,
    });
  } catch (err) {
    console.error("[stock-alert] POST failed:", err);
    return NextResponse.json(
      { message: "Impossible d'enregistrer l'alerte pour le moment." },
      { status: 500 },
    );
  }
}

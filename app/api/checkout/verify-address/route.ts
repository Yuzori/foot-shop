import { NextResponse } from "next/server";

import { verifyAddressWithGeoApi } from "@/lib/checkout-address-verify";
import {
  validateCheckoutAddressFields,
  type CheckoutAddressInput,
} from "@/lib/checkout-contact-validation";

export const runtime = "nodejs";

/** Vérifie le format et la cohérence code postal / ville (France). */
export async function POST(request: Request) {
  let body: Partial<CheckoutAddressInput>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Requête invalide." }, { status: 400 });
  }

  const address: CheckoutAddressInput = {
    address1: body.address1?.trim() ?? "",
    address2: body.address2?.trim(),
    postcode: body.postcode?.trim() ?? "",
    city: body.city?.trim() ?? "",
    country: body.country?.trim() || "France",
  };

  const formatError = validateCheckoutAddressFields(address);
  if (formatError) {
    if (formatError.includes("Adresse")) {
      return NextResponse.json({
        valid: false,
        field: "address1",
        message: formatError,
      });
    }
    if (formatError.includes("Code postal")) {
      return NextResponse.json({
        valid: false,
        field: "postcode",
        message: formatError,
      });
    }
    if (formatError.includes("ville") || formatError.includes("Ville")) {
      return NextResponse.json({
        valid: false,
        field: "city",
        message: formatError,
      });
    }
    if (formatError.includes("Pays")) {
      return NextResponse.json({
        valid: false,
        field: "country",
        message: formatError,
      });
    }
    return NextResponse.json({ valid: false, field: "address1", message: formatError });
  }

  const geoError = await verifyAddressWithGeoApi({
    postcode: address.postcode,
    city: address.city,
    country: address.country,
  });
  if (geoError) {
    return NextResponse.json({
      valid: false,
      field: geoError.includes("ville") ? "city" : "postcode",
      message: geoError,
    });
  }

  return NextResponse.json({ valid: true });
}

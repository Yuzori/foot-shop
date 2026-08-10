import "server-only";

import { resolveCountry } from "@/lib/checkout-contact-validation";

function normalizeCityName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .toLowerCase();
}

/** Vérifie la cohérence code postal / ville (France via geo.api.gouv.fr). */
export async function verifyAddressWithGeoApi(input: {
  postcode: string;
  city: string;
  country: string;
}): Promise<string | null> {
  const country = resolveCountry(input.country);
  if (!country || country.code !== "FR") {
    return null;
  }

  const postcode = input.postcode.trim();
  const city = input.city.trim();
  if (!postcode || !city) return null;

  try {
    const url = new URL("https://geo.api.gouv.fr/communes");
    url.searchParams.set("codePostal", postcode);
    url.searchParams.set("fields", "nom");
    url.searchParams.set("limit", "100");

    const res = await fetch(url, { next: { revalidate: 86_400 } });
    if (!res.ok) return null;

    const communes = (await res.json()) as { nom: string }[];
    if (!Array.isArray(communes) || communes.length === 0) {
      return "Code postal français inconnu.";
    }

    const wanted = normalizeCityName(city);
    const match = communes.some(
      (commune) => normalizeCityName(commune.nom) === wanted,
    );
    if (!match) {
      return "Cette ville ne correspond pas au code postal indiqué.";
    }
  } catch {
    return null;
  }

  return null;
}

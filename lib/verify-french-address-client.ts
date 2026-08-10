import { resolveCountry } from "@/lib/checkout-contact-validation";

const FR_POSTCODE_RE = /^(?:0[1-9]|[1-8]\d|9[0-8])\d{3}$/;

function normalizeCityName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .toLowerCase();
}

/** Vérifie code postal / ville (France) via l'API publique geo.api.gouv.fr — côté navigateur. */
export async function verifyFrenchPostcodeCity(input: {
  postcode: string;
  city: string;
  country: string;
}): Promise<{ field: "postcode" | "city"; message: string } | null> {
  const country = resolveCountry(input.country);
  if (!country || country.code !== "FR") return null;

  const postcode = input.postcode.trim();
  const city = input.city.trim();
  if (!FR_POSTCODE_RE.test(postcode) || city.length < 2) return null;

  try {
    const url = new URL("https://geo.api.gouv.fr/communes");
    url.searchParams.set("codePostal", postcode);
    url.searchParams.set("fields", "nom");
    url.searchParams.set("limit", "100");

    const res = await fetch(url.toString());
    if (!res.ok) return null;

    const communes = (await res.json()) as { nom: string }[];
    if (!Array.isArray(communes) || communes.length === 0) {
      return { field: "postcode", message: "Code postal français inconnu." };
    }

    const wanted = normalizeCityName(city);
    const match = communes.some(
      (commune) => normalizeCityName(commune.nom) === wanted,
    );
    if (!match) {
      return {
        field: "city",
        message: "Cette ville ne correspond pas au code postal indiqué.",
      };
    }
  } catch {
    return null;
  }

  return null;
}

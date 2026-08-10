/**
 * Validation des coordonnées de livraison (client + serveur).
 */

import {
  isValidPhoneNumber,
  type CountryCode,
} from "libphonenumber-js";

export type CheckoutContactInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
};

export type CheckoutFieldName =
  | "firstName"
  | "lastName"
  | "email"
  | "phone"
  | "address1"
  | "postcode"
  | "city"
  | "country";

export type CheckoutFieldErrors = Partial<Record<CheckoutFieldName, string>>;

export type CheckoutAddressInput = {
  address1: string;
  address2?: string;
  postcode: string;
  city: string;
  country: string;
};
const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const FR_POSTCODE_RE = /^(?:0[1-9]|[1-8]\d|9[0-8])\d{3}$/;
const GB_POSTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

const SUPPORTED_COUNTRIES: { code: string; label: string; aliases: string[] }[] = [
  { code: "FR", label: "France", aliases: ["france", "fr", "république française"] },
  { code: "BE", label: "Belgique", aliases: ["belgique", "belgium", "be"] },
  { code: "CH", label: "Suisse", aliases: ["suisse", "switzerland", "ch", "schweiz"] },
  { code: "LU", label: "Luxembourg", aliases: ["luxembourg", "lu"] },
  { code: "DE", label: "Allemagne", aliases: ["allemagne", "germany", "de", "deutschland"] },
  { code: "ES", label: "Espagne", aliases: ["espagne", "spain", "es", "españa"] },
  { code: "IT", label: "Italie", aliases: ["italie", "italy", "it", "italia"] },
  { code: "GB", label: "Royaume-Uni", aliases: ["royaume-uni", "uk", "gb", "united kingdom", "angleterre", "england"] },
];

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "");
}

export function resolveCountry(
  country: string,
): { code: string; label: string } | null {
  const normalized = stripAccents(country.trim().toLowerCase());
  if (!normalized) return null;

  for (const entry of SUPPORTED_COUNTRIES) {
    if (
      entry.code.toLowerCase() === normalized ||
      entry.label.toLowerCase() === normalized ||
      entry.aliases.includes(normalized)
    ) {
      return { code: entry.code, label: entry.label };
    }
  }
  return null;
}

export function validateCheckoutEmail(email: string): string | null {
  const value = email.trim();
  if (!value) return "Adresse email requise.";
  if (value.length > 254) return "Adresse email trop longue.";
  if (!EMAIL_RE.test(value)) return "Adresse email invalide.";
  if (value.includes("..")) return "Adresse email invalide.";
  return null;
}

export function validateCheckoutPhone(
  phone: string,
  countryInput = "France",
): string | null {
  const raw = phone.trim();
  if (!raw) return "Numéro de téléphone requis.";

  const country = resolveCountry(countryInput);
  const countryCode = (country?.code ?? "FR") as CountryCode;

  if (!isValidPhoneNumber(raw, countryCode)) {
    return "Numéro de téléphone invalide pour ce pays.";
  }

  return null;
}
function validatePostcodeForCountry(
  postcode: string,
  countryCode: string,
): string | null {
  const value = postcode.trim();
  if (!value) return "Code postal requis.";

  switch (countryCode) {
    case "FR":
      return FR_POSTCODE_RE.test(value)
        ? null
        : "Code postal français invalide (5 chiffres).";
    case "BE":
    case "CH":
    case "LU":
      return /^\d{4}$/.test(value)
        ? null
        : "Code postal invalide (4 chiffres).";
    case "DE":
    case "ES":
    case "IT":
      return /^\d{5}$/.test(value)
        ? null
        : "Code postal invalide (5 chiffres).";
    case "GB":
      return GB_POSTCODE_RE.test(value.replace(/\s+/g, " "))
        ? null
        : "Code postal britannique invalide.";
    default:
      return value.length >= 3 && value.length <= 12
        ? null
        : "Code postal invalide.";
  }
}

export function validateCheckoutAddressFields(
  address: CheckoutAddressInput,
): string | null {
  const line1 = address.address1.trim();
  if (line1.length < 5) {
    return "Adresse trop courte (5 caractères minimum).";
  }
  if (!/[a-zA-ZÀ-ÿ]/.test(line1) || !/\d/.test(line1)) {
    return "Indiquez un numéro et une rue valides.";
  }

  const city = address.city.trim();
  if (city.length < 2) return "Ville requise.";
  if (!/^[\p{L}\s'.-]+$/u.test(city)) {
    return "Nom de ville invalide.";
  }

  const country = resolveCountry(address.country);
  if (!country) {
    return "Pays non pris en charge. Livraison : France, Belgique, Suisse, Luxembourg, Allemagne, Espagne, Italie, Royaume-Uni.";
  }

  const postcodeError = validatePostcodeForCountry(address.postcode, country.code);
  if (postcodeError) return postcodeError;

  return null;
}

export function getCheckoutFieldErrors(
  contact: CheckoutContactInput,
  address: CheckoutAddressInput,
): CheckoutFieldErrors {
  const errors: CheckoutFieldErrors = {};

  if (!contact.firstName.trim()) errors.firstName = "Prénom requis.";
  if (!contact.lastName.trim()) errors.lastName = "Nom requis.";

  const emailError = validateCheckoutEmail(contact.email);
  if (emailError) errors.email = emailError;

  const phoneError = validateCheckoutPhone(
    contact.phone ?? "",
    address.country || "France",
  );
  if (phoneError) errors.phone = phoneError;

  const line1 = address.address1.trim();
  if (!line1) {
    errors.address1 = "Adresse requise.";
  } else if (line1.length < 5) {
    errors.address1 = "Adresse trop courte (5 caractères minimum).";
  } else if (!/[a-zA-ZÀ-ÿ]/.test(line1) || !/\d/.test(line1)) {
    errors.address1 = "Indiquez un numéro et une rue valides.";
  }

  const city = address.city.trim();
  if (!city) {
    errors.city = "Ville requise.";
  } else if (city.length < 2) {
    errors.city = "Ville requise.";
  } else if (!/^[\p{L}\s'.-]+$/u.test(city)) {
    errors.city = "Nom de ville invalide.";
  }

  const country = resolveCountry(address.country);
  if (!country) {
    errors.country =
      "Pays non pris en charge. Livraison : France, Belgique, Suisse, Luxembourg, Allemagne, Espagne, Italie, Royaume-Uni.";
  }

  const postcodeError = country
    ? validatePostcodeForCountry(address.postcode, country.code)
    : !address.postcode.trim()
      ? "Code postal requis."
      : null;
  if (postcodeError) errors.postcode = postcodeError;

  return errors;
}

export function validateCheckoutContactForm(
  contact: CheckoutContactInput,
  address: CheckoutAddressInput,
): string | null {
  if (!contact.firstName.trim() || !contact.lastName.trim()) {
    return "Prénom et nom requis.";
  }

  const emailError = validateCheckoutEmail(contact.email);
  if (emailError) return emailError;

  const phoneError = validateCheckoutPhone(
    contact.phone ?? "",
    address.country || "France",
  );
  if (phoneError) return phoneError;

  return validateCheckoutAddressFields(address);
}

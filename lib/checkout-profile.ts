/** Profil de livraison enregistré (coordonnées + adresse). */

export interface CheckoutDeliveryProfile {
  contact: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
  address: {
    address1: string;
    address2?: string;
    postcode: string;
    city: string;
    country: string;
  };
  updatedAt: string;
}

export const CHECKOUT_PROFILE_STORAGE_KEY = "footshop-checkout-profile";

export function emptyCheckoutProfile(): CheckoutDeliveryProfile {
  return {
    contact: { firstName: "", lastName: "", email: "", phone: "" },
    address: {
      address1: "",
      address2: "",
      postcode: "",
      city: "",
      country: "France",
    },
    updatedAt: "",
  };
}

export function isCheckoutProfileComplete(
  profile: CheckoutDeliveryProfile,
): boolean {
  const { contact, address } = profile;
  return Boolean(
    contact.firstName.trim() &&
      contact.lastName.trim() &&
      contact.email.trim() &&
      address.address1.trim() &&
      address.postcode.trim() &&
      address.city.trim() &&
      address.country.trim(),
  );
}

export function loadCheckoutProfileFromStorage(): CheckoutDeliveryProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CHECKOUT_PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as CheckoutDeliveryProfile;
    if (!data?.contact || !data?.address) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveCheckoutProfileToStorage(
  profile: CheckoutDeliveryProfile,
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      CHECKOUT_PROFILE_STORAGE_KEY,
      JSON.stringify({ ...profile, updatedAt: new Date().toISOString() }),
    );
  } catch {
    /* quota / private mode */
  }
}

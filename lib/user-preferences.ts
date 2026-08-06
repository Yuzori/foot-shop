import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import type { CheckoutDeliveryProfile } from "@/lib/checkout-profile";
import type { CartLine } from "@/types/domain";

export interface UserPreferences {
  cart: CartLine[];
  favorites: string[];
  checkoutProfile?: CheckoutDeliveryProfile | null;
  stripeCustomerId?: string | null;
  updatedAt: string;
}

const DATA_DIR = path.join(process.cwd(), ".data", "user-preferences");

function normalizeCustomerId(customerId: string | number): string {
  return String(customerId).trim();
}

function fileFor(customerId: string | number): string {
  const safe = normalizeCustomerId(customerId).replace(/[^\w-]/g, "");
  return path.join(DATA_DIR, `${safe}.json`);
}

export async function readUserPreferences(
  customerId: string | number,
): Promise<UserPreferences> {
  try {
    const raw = await fs.readFile(fileFor(customerId), "utf8");
    const data = JSON.parse(raw) as UserPreferences;
    return {
      cart: Array.isArray(data.cart) ? data.cart : [],
      favorites: Array.isArray(data.favorites) ? data.favorites : [],
      checkoutProfile: data.checkoutProfile ?? null,
      stripeCustomerId: data.stripeCustomerId ?? null,
      updatedAt: data.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return {
      cart: [],
      favorites: [],
      checkoutProfile: null,
      stripeCustomerId: null,
      updatedAt: new Date().toISOString(),
    };
  }
}

export async function writeUserPreferences(
  customerId: string | number,
  input: {
    cart: CartLine[];
    favorites: string[];
    checkoutProfile?: CheckoutDeliveryProfile | null;
    stripeCustomerId?: string | null;
  },
): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const current = await readUserPreferences(customerId);
  const payload: UserPreferences = {
    cart: input.cart,
    favorites: input.favorites,
    checkoutProfile:
      input.checkoutProfile !== undefined
        ? input.checkoutProfile
        : current.checkoutProfile ?? null,
    stripeCustomerId:
      input.stripeCustomerId !== undefined
        ? input.stripeCustomerId
        : current.stripeCustomerId ?? null,
    updatedAt: new Date().toISOString(),
  };
  await fs.writeFile(fileFor(customerId), JSON.stringify(payload, null, 2), "utf8");
}

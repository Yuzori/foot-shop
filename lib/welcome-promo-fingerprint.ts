import "server-only";

import crypto from "node:crypto";

import type { CheckoutBody } from "@/lib/orders";

function fingerprintSecret(): string {
  return (
    process.env.PROMO_FINGERPRINT_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    "foot-shop-promo-fingerprint"
  );
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("33") && digits.length >= 11) {
    return `0${digits.slice(2)}`;
  }
  return digits;
}

export function buildWelcomePromoIdentityPayload(
  contact: CheckoutBody["contact"],
  address: CheckoutBody["address"],
): string {
  return [
    normalizeText(contact.firstName ?? ""),
    normalizeText(contact.lastName ?? ""),
    normalizePhone(contact.phone ?? ""),
    normalizeText(address.address1 ?? ""),
    normalizeText(address.postcode ?? ""),
    normalizeText(address.city ?? ""),
    normalizeText(address.country ?? "france"),
  ].join("|");
}

export function hashWelcomePromoIdentity(
  contact: CheckoutBody["contact"],
  address: CheckoutBody["address"],
): string {
  const payload = buildWelcomePromoIdentityPayload(contact, address);
  return crypto
    .createHmac("sha256", fingerprintSecret())
    .update(`identity:${payload}`)
    .digest("hex")
    .slice(0, 40);
}

export function hashWelcomePromoIp(clientIp: string): string {
  const ip = clientIp.trim().toLowerCase();
  return crypto
    .createHmac("sha256", fingerprintSecret())
    .update(`ip:${ip}`)
    .digest("hex")
    .slice(0, 40);
}

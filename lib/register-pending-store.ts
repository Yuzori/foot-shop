import "server-only";

import crypto from "node:crypto";

export interface PendingRegistration {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  newsletter: boolean;
  codeHash: string;
  expiresAt: number;
  attempts: number;
}

const TTL_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const store: Map<string, PendingRegistration> =
  (globalThis as { __registerPending?: Map<string, PendingRegistration> })
    .__registerPending ?? new Map();
(globalThis as { __registerPending?: Map<string, PendingRegistration> }).__registerPending =
  store;

function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function key(email: string): string {
  return email.trim().toLowerCase();
}

export function createRegistrationCode(
  data: Omit<PendingRegistration, "codeHash" | "expiresAt" | "attempts">,
): string {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  store.set(key(data.email), {
    ...data,
    codeHash: hashCode(code),
    expiresAt: Date.now() + TTL_MS,
    attempts: 0,
  });
  return code;
}

export function verifyRegistrationCode(
  email: string,
  code: string,
): PendingRegistration | null {
  const entry = store.get(key(email));
  if (!entry) return null;

  if (Date.now() > entry.expiresAt || entry.attempts >= MAX_ATTEMPTS) {
    store.delete(key(email));
    return null;
  }

  entry.attempts += 1;

  const provided = hashCode(code.trim());
  const a = Buffer.from(provided);
  const b = Buffer.from(entry.codeHash);
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!ok) return null;

  store.delete(key(email));
  return entry;
}

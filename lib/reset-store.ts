import "server-only";

import crypto from "node:crypto";

/**
 * Password-reset code store.
 *
 * Codes are 6 digits, hashed (never stored in clear), single-use and expire
 * after 15 minutes. Stored in memory (persisted on globalThis to survive dev
 * hot-reloads). For a multi-instance production deployment, swap this for Redis
 * or a DB table — the public API (create/verify) stays identical.
 */

interface ResetEntry {
  codeHash: string;
  expiresAt: number;
  attempts: number;
}

const TTL_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const store: Map<string, ResetEntry> =
  (globalThis as { __resetStore?: Map<string, ResetEntry> }).__resetStore ??
  new Map();
(globalThis as { __resetStore?: Map<string, ResetEntry> }).__resetStore = store;

function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function key(email: string): string {
  return email.trim().toLowerCase();
}

/** Generate, store and return a fresh 6-digit code for an email. */
export function createResetCode(email: string): string {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  store.set(key(email), {
    codeHash: hashCode(code),
    expiresAt: Date.now() + TTL_MS,
    attempts: 0,
  });
  return code;
}

/** Verify a code (single-use). Returns true and consumes it on success. */
export function verifyResetCode(email: string, code: string): boolean {
  const entry = store.get(key(email));
  if (!entry) return false;

  if (Date.now() > entry.expiresAt || entry.attempts >= MAX_ATTEMPTS) {
    store.delete(key(email));
    return false;
  }

  entry.attempts += 1;

  const provided = hashCode(code.trim());
  const a = Buffer.from(provided);
  const b = Buffer.from(entry.codeHash);
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (ok) store.delete(key(email));
  return ok;
}

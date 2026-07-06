import "server-only";

import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { cookies } from "next/headers";

/**
 * Customer session handling.
 *
 * The session is a stateless, HMAC-signed token stored in an httpOnly cookie.
 * It carries only non-sensitive identity info (id, email, name). Passwords are
 * verified against the PrestaShop bcrypt hash and NEVER stored client-side.
 */

const COOKIE_NAME = "maillot_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET is required in production.");
    }
    // Dev fallback only — set AUTH_SECRET in .env.local.
    return "dev-insecure-secret-change-me";
  }
  return secret;
}

function sign(payloadB64: string): string {
  return crypto
    .createHmac("sha256", getSecret())
    .update(payloadB64)
    .digest("base64url");
}

export function createToken(user: SessionUser): string {
  const payload = Buffer.from(JSON.stringify(user)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token: string): SessionUser | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString()) as SessionUser;
  } catch {
    return null;
  }
}

export async function setSession(user: SessionUser): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, createToken(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  return token ? verifyToken(token) : null;
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  if (!hash) return false;

  if (hash.startsWith("$2")) {
    const normalized = hash.startsWith("$2y$") ? `$2a$${hash.slice(4)}` : hash;
    try {
      if (await bcrypt.compare(plain, normalized)) return true;
    } catch {
      /* legacy fallback below */
    }
  }

  const cookieKey = process.env.PRESTASHOP_COOKIE_KEY;
  if (cookieKey) {
    const legacy = crypto
      .createHash("md5")
      .update(cookieKey + plain)
      .digest("hex");
    if (legacy === hash) return true;
  }

  return false;
}

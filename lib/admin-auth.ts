import "server-only";

import crypto from "node:crypto";

import { mailConfig } from "@/config/mail";

export function readAdminSecret(request: Request): string {
  const bearer = request.headers.get("authorization");
  if (bearer?.startsWith("Bearer ")) return bearer.slice(7).trim();

  const headerSecret = request.headers.get("x-admin-secret")?.trim();
  if (headerSecret) return headerSecret;

  try {
    const querySecret = new URL(request.url).searchParams.get("pluginSecret")?.trim();
    if (querySecret) return querySecret;
  } catch {
    // ignore invalid URL
  }

  return "";
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function isAdminAuthorized(request: Request): boolean {
  const expected = mailConfig.adminSecret;
  if (!expected) return false;
  return safeEqual(readAdminSecret(request), expected);
}

export function isCronAuthorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET ?? mailConfig.adminSecret;
  if (!expected) return false;
  return safeEqual(readAdminSecret(request), expected);
}

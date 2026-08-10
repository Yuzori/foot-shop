import { mailConfig } from "@/config/mail";

export function readAdminAuthSecret(request: Request): string {
  const bearer = request.headers.get("authorization");
  if (bearer?.startsWith("Bearer ")) return bearer.slice(7).trim();
  return request.headers.get("x-admin-secret")?.trim() ?? "";
}

export function isAdminAuthorized(request: Request): boolean {
  const secret = mailConfig.adminSecret;
  if (!secret) return false;
  return readAdminAuthSecret(request) === secret;
}

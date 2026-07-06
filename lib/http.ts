import axios from "axios";

import { INTERNAL_API_BASE } from "@/config";

/**
 * HTTP client used by the BROWSER to talk to our own Next.js route handlers
 * (under /api). It NEVER talks to PrestaShop directly — that keeps the
 * Webservice key secret on the server and the front fully decoupled.
 *
 * All PrestaShop requests live in `services/prestashop.ts` (server-side).
 */
export const http = axios.create({
  baseURL: INTERNAL_API_BASE,
  timeout: 20000,
  headers: { Accept: "application/json" },
});

/** Narrow unknown errors into a readable message. */
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return (
      (error.response?.data as { message?: string } | undefined)?.message ??
      error.message
    );
  }
  if (error instanceof Error) return error.message;
  return "Une erreur inattendue est survenue.";
}

import "server-only";

import { productImportConfig } from "@/config/product-import";
import { validateRedirectUrl, validateSourceUrl } from "@/lib/product-import/validate-url";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
];

const MAX_REDIRECT_HOPS = 12;

function browserHeaders(url: URL, attempt: number): HeadersInit {
  const origin = url.origin;
  return {
    "User-Agent": USER_AGENTS[attempt % USER_AGENTS.length]!,
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    Referer: `${origin}/`,
    Origin: origin,
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
    "Upgrade-Insecure-Requests": "1",
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readHtmlResponse(response: Response): Promise<string> {
  const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
  if (
    contentType &&
    (contentType.startsWith("image/") || contentType.includes("application/json"))
  ) {
    throw new Error("L'URL ne pointe pas vers une page HTML.");
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("Réponse vide.");

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > productImportConfig.maxHtmlBytes) {
      throw new Error("Page trop volumineuse.");
    }
    chunks.push(value);
  }

  return new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks));
}

async function fetchWithManualRedirects(
  startUrl: URL,
  attempt: number,
  signal: AbortSignal,
): Promise<string> {
  let current = startUrl;

  for (let hop = 0; hop < MAX_REDIRECT_HOPS; hop++) {
    const response = await fetch(current.toString(), {
      signal,
      headers: browserHeaders(current, attempt),
      redirect: "manual",
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Redirection invalide (Location manquante).");
      current = await validateRedirectUrl(location, current);
      continue;
    }

    if (response.status === 403 || response.status === 429) {
      throw new Error(
        `Accès refusé (${response.status}). Réessayez plus tard ou changez de source.`,
      );
    }

    if (response.status >= 500) {
      throw new Error(`Erreur serveur (${response.status}).`);
    }

    if (!response.ok) {
      throw new Error(`La page a répondu avec le code ${response.status}.`);
    }

    return readHtmlResponse(response);
  }

  throw new Error("Trop de redirections.");
}

async function fetchWithFollowRedirects(
  startUrl: URL,
  attempt: number,
  signal: AbortSignal,
): Promise<string> {
  const response = await fetch(startUrl.toString(), {
    signal,
    headers: browserHeaders(startUrl, attempt),
    redirect: "follow",
  });

  if (response.status === 403 || response.status === 429) {
    throw new Error(
      `Accès refusé (${response.status}). Réessayez plus tard ou changez de source.`,
    );
  }

  if (!response.ok) {
    throw new Error(`La page a répondu avec le code ${response.status}.`);
  }

  return readHtmlResponse(response);
}

/** Télécharge une page HTML avec retries (403, 429, 5xx) et redirections validées. */
export async function fetchProductPageHtml(url: URL): Promise<string> {
  const maxAttempts = 5;
  let lastError = "Impossible d'accéder à l'URL fournie.";

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      productImportConfig.fetchTimeoutMs + attempt * 3_000,
    );

    try {
      const start = await validateSourceUrl(url.toString());

      try {
        return await fetchWithFollowRedirects(start, attempt, controller.signal);
      } catch {
        return await fetchWithManualRedirects(start, attempt, controller.signal);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        lastError = "Délai dépassé lors de la récupération de la page.";
      } else if (err instanceof Error) {
        lastError = err.message;
      }
      if (attempt < maxAttempts - 1) await sleep(900 * (attempt + 1));
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(lastError);
}

import "server-only";

import { resolve4, resolveMx } from "node:dns/promises";
import net from "node:net";

import { validateCheckoutEmail } from "@/lib/checkout-contact-validation";

/** Domaines jetables / temporaires courants (non exhaustif). */
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "tempmail.com",
  "temp-mail.org",
  "10minutemail.com",
  "yopmail.com",
  "yopmail.fr",
  "yopmail.net",
  "throwaway.email",
  "getnada.com",
  "maildrop.cc",
  "sharklasers.com",
  "trashmail.com",
  "dispostable.com",
  "fakeinbox.com",
  "mintemail.com",
  "emailondeck.com",
]);

export type EmailDeliverabilityResult =
  | { valid: true }
  | { valid: false; message: string };

async function resolveMailHost(domain: string): Promise<string | null> {
  try {
    const mx = await resolveMx(domain);
    if (mx.length > 0) {
      return mx.sort((a, b) => a.priority - b.priority)[0]!.exchange;
    }
  } catch {
    /* domaine sans MX */
  }

  try {
    await resolve4(domain);
    return domain;
  } catch {
    return null;
  }
}

function readSmtpCode(buffer: string): number | null {
  const line = buffer.split(/\r?\n/).find((row) => /^\d{3}/.test(row));
  if (!line) return null;
  const code = Number.parseInt(line.slice(0, 3), 10);
  return Number.isFinite(code) ? code : null;
}

/**
 * Tente une vérification SMTP RCPT TO (meilleure effort).
 * Beaucoup de fournisseurs (Gmail, Outlook) répondent toujours OK → inconclusif.
 */
const SMTP_PROBE_MS = 6_000;
const DELIVERABILITY_TIMEOUT_MS = 8_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | "timeout"> {
  return Promise.race([
    promise,
    new Promise<"timeout">((resolve) => {
      setTimeout(() => resolve("timeout"), ms);
    }),
  ]);
}

function smtpMailboxProbe(
  mxHost: string,
  email: string,
): Promise<"valid" | "invalid" | "unknown"> {
  return new Promise((resolve) => {
    const socket = net.connect({ host: mxHost, port: 25, timeout: SMTP_PROBE_MS });
    let buffer = "";
    let step = 0;
    let settled = false;

    const finish = (result: "valid" | "invalid" | "unknown") => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    const commands = [
      "EHLO foot-shop.fr\r\n",
      "MAIL FROM:<noreply@foot-shop.fr>\r\n",
      `RCPT TO:<${email}>\r\n`,
      "QUIT\r\n",
    ];

    const sendNext = () => {
      const cmd = commands[step];
      if (!cmd) return;
      socket.write(cmd);
      step += 1;
    };

    socket.on("connect", () => {
      /* attend le banner 220 */
    });

    socket.on("data", (chunk) => {
      buffer += chunk.toString();
      if (!buffer.includes("\n")) return;

      const code = readSmtpCode(buffer);
      buffer = "";

      if (code == null) return;

      if (step === 0) {
        if (code !== 220) return finish("unknown");
        sendNext();
        return;
      }

      if (step === 1) {
        if (code >= 400) return finish("unknown");
        sendNext();
        return;
      }

      if (step === 2) {
        if (code >= 400) return finish("unknown");
        sendNext();
        return;
      }

      if (step === 3) {
        if (code >= 550 && code <= 553) return finish("invalid");
        if (code >= 250 && code < 300) return finish("valid");
        return finish("unknown");
      }

      sendNext();
    });

    socket.on("error", () => finish("unknown"));
    socket.on("timeout", () => finish("unknown"));

    setTimeout(() => finish("unknown"), SMTP_PROBE_MS + 500);
  });
}

/** Vérifie qu'une adresse email peut recevoir des messages (DNS + SMTP si possible). */
export async function verifyEmailDeliverability(
  email: string,
): Promise<EmailDeliverabilityResult> {
  try {
    const result = await withTimeout(
      verifyEmailDeliverabilityInner(email),
      DELIVERABILITY_TIMEOUT_MS,
    );
    if (result === "timeout") {
      return { valid: true };
    }
    return result;
  } catch (error) {
    console.warn("[verifyEmailDeliverability] skipped", error);
    return { valid: true };
  }
}

async function verifyEmailDeliverabilityInner(
  email: string,
): Promise<EmailDeliverabilityResult> {
  const formatError = validateCheckoutEmail(email);
  if (formatError) {
    return { valid: false, message: formatError };
  }

  const domain = email.split("@")[1]?.toLowerCase().trim() ?? "";
  if (!domain) {
    return { valid: false, message: "Adresse email invalide." };
  }

  if (DISPOSABLE_DOMAINS.has(domain)) {
    return {
      valid: false,
      message: "Les adresses email temporaires ne sont pas acceptées.",
    };
  }

  const mxHost = await resolveMailHost(domain);
  if (!mxHost) {
    return {
      valid: false,
      message: "Le domaine de cette adresse email n'existe pas.",
    };
  }

  const smtp = await smtpMailboxProbe(mxHost, email.trim());
  if (smtp === "invalid") {
    return {
      valid: false,
      message: "Cette adresse email semble inexistante.",
    };
  }

  return { valid: true };
}

import "server-only";

import { mailConfig } from "@/config/mail";

export interface MailMessage {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  /** Reply-To (ex. email du visiteur sur le formulaire contact). */
  replyTo?: string;
}

export interface SendMailResult {
  delivered: boolean;
  devMode: boolean;
  error?: string;
  provider?: "resend" | "smtp";
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildTransportOptions() {
  const useStartTls = mailConfig.port === 587 && !mailConfig.secure;

  return {
    host: mailConfig.host,
    port: mailConfig.port,
    secure: mailConfig.secure,
    auth: { user: mailConfig.user, pass: mailConfig.password },
    connectionTimeout: mailConfig.connectionTimeoutMs,
    greetingTimeout: mailConfig.connectionTimeoutMs,
    socketTimeout: mailConfig.socketTimeoutMs,
    family: 4,
    ...(useStartTls ? { requireTLS: true as const } : {}),
    tls: {
      minVersion: "TLSv1.2" as const,
      servername: mailConfig.host,
    },
  };
}

async function sendViaResend(
  message: MailMessage,
  text: string,
  html?: string,
): Promise<SendMailResult> {
  const to = Array.isArray(message.to) ? message.to : [message.to];
  const payload: Record<string, unknown> = {
    from: mailConfig.from,
    to,
    subject: message.subject,
    text,
  };
  if (html) payload.html = html;

  const replyTo = message.replyTo ?? mailConfig.replyTo;
  if (replyTo) payload.reply_to = replyTo;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${mailConfig.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        message?: string;
      } | null;
      const error = body?.message ?? `resend_http_${res.status}`;
      console.error("[mail:error]", error);
      return { delivered: false, devMode: false, error, provider: "resend" };
    }

    return { delivered: true, devMode: false, provider: "resend" };
  } catch (err) {
    const error = err instanceof Error ? err.message : "resend_failed";
    console.error("[mail:error]", error);
    return { delivered: false, devMode: false, error, provider: "resend" };
  } finally {
    clearTimeout(timer);
  }
}

async function sendViaSmtp(
  message: MailMessage,
  text: string,
  html?: string,
): Promise<SendMailResult> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nodemailer: any = await import("nodemailer");
    const transport = nodemailer.createTransport(buildTransportOptions());

    await transport.sendMail({
      from: mailConfig.from,
      to: message.to,
      subject: message.subject,
      text,
      html,
      replyTo: message.replyTo ?? mailConfig.replyTo,
      headers: {
        "X-Mailer": "Foot Shop",
      },
    });

    return { delivered: true, devMode: false, provider: "smtp" };
  } catch (err) {
    const error = err instanceof Error ? err.message : "send_failed";
    console.error("[mail:error]", error);
    return { delivered: false, devMode: false, error, provider: "smtp" };
  }
}

/**
 * Envoie un email via Resend (HTTP, recommandé sur Render) ou SMTP Hostinger.
 * Sans configuration, log en console et retourne `delivered: false`.
 */
export async function sendMail(message: MailMessage): Promise<SendMailResult> {
  if (!mailConfig.enabled) {
    console.info(
      "[mail:dev] (email non configuré) →",
      JSON.stringify(
        {
          to: message.to,
          subject: message.subject,
          text: message.text,
        },
        null,
        2,
      ),
    );
    return { delivered: false, devMode: true };
  }

  const text =
    message.text ??
    (message.html ? htmlToPlainText(message.html) : message.subject);
  const html = message.html ?? undefined;

  if (mailConfig.provider === "resend") {
    return sendViaResend(message, text, html);
  }

  return sendViaSmtp(message, text, html);
}

export function assertMailDelivered(
  result: SendMailResult,
  context: string,
): void {
  if (result.devMode) {
    throw new Error(`Email non configuré — ${context}`);
  }
  if (!result.delivered) {
    throw new Error(result.error ?? `Échec d'envoi — ${context}`);
  }
}

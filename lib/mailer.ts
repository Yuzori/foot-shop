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
    ...(useStartTls ? { requireTLS: true as const } : {}),
    tls: {
      minVersion: "TLSv1.2" as const,
      servername: mailConfig.host,
    },
  };
}

/**
 * Envoie un email via SMTP Hostinger (nodemailer).
 * Sans SMTP configuré, log en console et retourne `delivered: false`.
 */
export async function sendMail(message: MailMessage): Promise<SendMailResult> {
  if (!mailConfig.enabled) {
    console.info(
      "[mail:dev] (SMTP non configuré) →",
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

    return { delivered: true, devMode: false };
  } catch (err) {
    const error = err instanceof Error ? err.message : "send_failed";
    console.error("[mail:error]", error);
    return { delivered: false, devMode: false, error };
  }
}

export function assertMailDelivered(
  result: SendMailResult,
  context: string,
): void {
  if (result.devMode) {
    throw new Error(`SMTP non configuré — ${context}`);
  }
  if (!result.delivered) {
    throw new Error(result.error ?? `Échec d'envoi — ${context}`);
  }
}

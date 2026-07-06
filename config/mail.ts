/**
 * Email configuration (server-only).
 *
 * Production sur Render : Hostinger SMTP (smtp.hostinger.com) est souvent
 * injoignable (Connection timeout). Utiliser Resend (API HTTP) :
 *
 *   RESEND_API_KEY=re_...
 *   MAIL_FROM="Foot Shop <contact@foot-shop.fr>"
 *
 * Vérifier le domaine foot-shop.fr dans le dashboard Resend (DNS SPF/DKIM).
 *
 * SMTP Hostinger (local / si ça passe depuis votre hébergeur) :
 *   SMTP_HOST=smtp.hostinger.com
 *   SMTP_PORT=587
 *   SMTP_SECURE=0
 *   SMTP_USER=contact@foot-shop.fr
 *   SMTP_PASSWORD=...
 *
 * Forcer le transport : MAIL_PROVIDER=resend | smtp
 */
import "server-only";

function extractEmailAddress(value: string): string {
  const match = value.match(/<([^>]+)>/);
  return (match?.[1] ?? value).trim().toLowerCase();
}

const smtpUser = process.env.SMTP_USER ?? "";
const mailFrom = process.env.MAIL_FROM ?? "Foot Shop <contact@foot-shop.fr>";
const contactEmail = process.env.CONTACT_EMAIL ?? "contact@foot-shop.fr";
const resendApiKey = process.env.RESEND_API_KEY ?? "";
const mailProvider = (process.env.MAIL_PROVIDER ?? "").trim().toLowerCase();

if (
  process.env.NODE_ENV !== "production" &&
  smtpUser &&
  mailFrom &&
  extractEmailAddress(mailFrom) !== smtpUser.toLowerCase()
) {
  console.warn(
    "[mail] MAIL_FROM et SMTP_USER devraient être la même adresse (ex. contact@foot-shop.fr) pour éviter les spams.",
  );
}

export type MailProvider = "resend" | "smtp" | "none";

export const mailConfig = {
  host: process.env.SMTP_HOST ?? "",
  port: Number(process.env.SMTP_PORT ?? "465"),
  secure: process.env.SMTP_SECURE !== "0",
  user: smtpUser,
  password: process.env.SMTP_PASSWORD ?? "",
  from: mailFrom,
  replyTo: process.env.MAIL_REPLY_TO ?? contactEmail,
  contactEmail,
  adminSecret: process.env.ADMIN_SECRET ?? "",
  resendApiKey,
  connectionTimeoutMs: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS ?? "10000"),
  socketTimeoutMs: Number(process.env.SMTP_SOCKET_TIMEOUT_MS ?? "15000"),
  get smtpEnabled(): boolean {
    return Boolean(this.host && this.user && this.password);
  },
  get resendEnabled(): boolean {
    return Boolean(this.resendApiKey);
  },
  get provider(): MailProvider {
    if (mailProvider === "resend" && this.resendEnabled) return "resend";
    if (mailProvider === "smtp" && this.smtpEnabled) return "smtp";
    if (this.resendEnabled) return "resend";
    if (this.smtpEnabled) return "smtp";
    return "none";
  },
  get enabled(): boolean {
    return this.provider !== "none";
  },
} as const;

/**
 * Email configuration (server-only).
 *
 * Hostinger Email — contact@foot-shop.fr (hPanel → Emails → Connect Apps & Devices) :
 *
 *   SMTP_HOST=smtp.hostinger.com
 *   SMTP_PORT=465
 *   SMTP_SECURE=1
 *   SMTP_USER=contact@foot-shop.fr
 *   SMTP_PASSWORD=...                    (mot de passe de la boîte Hostinger)
 *   MAIL_FROM="Foot Shop <contact@foot-shop.fr>"
 *   CONTACT_EMAIL=contact@foot-shop.fr
 *   MAIL_REPLY_TO=contact@foot-shop.fr
 *
 * Si le port 465 échoue, essayez :
 *   SMTP_PORT=587
 *   SMTP_SECURE=0
 *
 * Anti-spam (DNS chez Hostinger, pas dans le code) :
 *   - SPF : enregistrement TXT incluant Hostinger
 *   - DKIM : activé dans hPanel → Emails → Authentification email
 *   - DMARC : enregistrement TXT _dmarc.foot-shop.fr
 *
 * ADMIN_SECRET, SUPPLIER_EMAIL, CRON_SECRET — inchangés.
 */
import "server-only";

function extractEmailAddress(value: string): string {
  const match = value.match(/<([^>]+)>/);
  return (match?.[1] ?? value).trim().toLowerCase();
}

const smtpUser = process.env.SMTP_USER ?? "";
const mailFrom = process.env.MAIL_FROM ?? "Foot Shop <contact@foot-shop.fr>";
const contactEmail = process.env.CONTACT_EMAIL ?? "contact@foot-shop.fr";

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
  get enabled(): boolean {
    return Boolean(this.host && this.user && this.password);
  },
} as const;

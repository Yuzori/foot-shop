import "server-only";

import { publicConfig } from "@/config";

/** Mise en page HTML commune pour tous les emails transactionnels. */
export function emailLayout(body: string): string {
  const site = publicConfig.siteName;
  const base = publicConfig.siteUrl.replace(/\/$/, "");

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Poppins,'Segoe UI',Arial,Helvetica,sans-serif;color:#0a0a0a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f6;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">
        <tr><td style="height:4px;background:#66BAFF"></td></tr>
        <tr><td style="padding:32px 28px 8px">
          <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.28em;text-transform:uppercase;color:#3DA8F5">${site}</p>
        </td></tr>
        <tr><td style="padding:8px 28px 32px">${body}</td></tr>
        <tr><td style="padding:20px 28px;background:#0a0a0a;color:#999;font-size:11px;line-height:1.6">
          <a href="${base}" style="color:#fff;text-decoration:none">${site}</a>
          <p style="margin:12px 0 0;color:#777;font-size:11px;line-height:1.5">Ce message est une notification légitime de notre boutique — ce n'est pas du spam.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function emailButton(href: string, label: string): string {
  return `<p style="margin:24px 0 0"><a href="${href}" style="display:inline-block;background:#0a0a0a;color:#ffffff;padding:14px 24px;border-radius:999px;text-decoration:none;font-size:14px;font-weight:600">${label}</a></p>`;
}

export function emailProductImage(imageUrl: string, alt: string): string {
  if (!imageUrl) return "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px">
    <tr><td align="center" style="padding:12px;background:#f4f4f5;border-radius:16px">
      <img src="${imageUrl}" alt="${escapeHtml(alt)}" width="280" style="display:block;max-width:280px;width:100%;height:auto;border-radius:12px" />
    </td></tr>
  </table>`;
}

export function emailAntiSpamNote(): string {
  return emailParagraph(
    "Ce message est une notification légitime de votre demande sur notre boutique — ce n'est pas du spam.",
  );
}

export function emailHeading(text: string): string {
  return `<h1 style="margin:0 0 12px;font-size:22px;font-weight:700;line-height:1.25">${text}</h1>`;
}

export function emailParagraph(text: string): string {
  return `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#333">${text}</p>`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

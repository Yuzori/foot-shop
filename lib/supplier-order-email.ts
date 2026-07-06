import "server-only";

import { publicConfig } from "@/config";
import { mailConfig } from "@/config/mail";
import {
  emailButton,
  emailHeading,
  emailLayout,
  emailParagraph,
  escapeHtml,
} from "@/lib/email-template";
import { assertMailDelivered, sendMail } from "@/lib/mailer";
import type { BbdBuyOrderDraft } from "@/lib/bbdbuy/types";

function supplierInbox(): string {
  return (
    process.env.SUPPLIER_EMAIL?.trim() ||
    process.env.CONTACT_EMAIL?.trim() ||
    mailConfig.contactEmail
  );
}

export async function sendBbdBuyOperatorEmail(
  draft: BbdBuyOrderDraft,
): Promise<void> {
  const to = supplierInbox();
  const linesHtml = draft.lines
    .map((line, index) => {
      const img = line.imageUrl
        ? `<img src="${escapeHtml(line.imageUrl)}" alt="" width="72" height="72" style="display:block;width:72px;height:72px;object-fit:contain;border-radius:8px;background:#f6f6f6;margin-bottom:10px" />`
        : "";

      return `<div style="margin:0 0 20px;padding:16px;border:1px solid #eee;border-radius:12px">
        ${img}
        <p style="margin:0 0 8px;font-size:13px;font-weight:700">${index + 1}. ${escapeHtml(line.name)} × ${line.quantity}</p>
        <p style="margin:0 0 6px;font-size:13px"><strong>Taille :</strong> ${escapeHtml(line.size ?? "à confirmer")}</p>
        ${line.supplierUrl ? `<p style="margin:0 0 6px;font-size:13px"><strong>Lien source (optionnel) :</strong><br/><a href="${escapeHtml(line.supplierUrl)}" style="color:#0a0a0a">${escapeHtml(line.supplierUrl)}</a></p>` : ""}
        ${line.supplierNotes ? `<p style="margin:0;font-size:12px;color:#666">${escapeHtml(line.supplierNotes)}</p>` : ""}
      </div>`;
    })
    .join("");

  const checklistHtml = draft.checklist
    .map((step) => `<li style="margin:0 0 8px">${escapeHtml(step)}</li>`)
    .join("");

  const body = `
    ${emailHeading(`Commande BBDBuy — ${draft.reference}`)}
    ${emailParagraph("Nouvelle commande payée sur Foot Shop. Brouillon prêt pour saisie sur <strong>bbdbuy.com</strong>.")}
    ${emailParagraph(`<strong>Référence boutique :</strong> ${escapeHtml(draft.reference)}`)}
    ${emailParagraph(`<strong>Client :</strong> ${escapeHtml(draft.customer.firstName)} ${escapeHtml(draft.customer.lastName)}${draft.customer.phone ? ` — ${escapeHtml(draft.customer.phone)}` : ""}`)}
    ${emailParagraph(`<strong>Livraison :</strong><br/>
      ${escapeHtml(draft.shipping.address1)}<br/>
      ${draft.shipping.address2 ? `${escapeHtml(draft.shipping.address2)}<br/>` : ""}
      ${escapeHtml(draft.shipping.postcode)} ${escapeHtml(draft.shipping.city)}<br/>
      ${escapeHtml(draft.shipping.country)}`)}
    ${draft.flocageNote ? emailParagraph(`<strong>Flocage :</strong><br/><pre style="white-space:pre-wrap;font-family:monospace;font-size:12px;background:#f6f6f6;padding:12px;border-radius:8px">${escapeHtml(draft.flocageNote)}</pre>`) : ""}
    <h2 style="margin:24px 0 12px;font-size:16px">Articles à commander</h2>
    ${linesHtml}
    <h2 style="margin:24px 0 12px;font-size:16px">Checklist BBDBuy</h2>
    <ol style="margin:0;padding-left:20px;font-size:14px;line-height:1.6">${checklistHtml}</ol>
    ${emailButton("https://www.bbdbuy.com", "Ouvrir BBDBuy")}
  `;

  const textLines = draft.lines
    .map(
      (line, i) =>
        `${i + 1}. ${line.name} × ${line.quantity}\n   Taille: ${line.size ?? "?"}\n   Lien: ${line.supplierUrl ?? "MANQUANT"}`,
    )
    .join("\n\n");

  const text = [
    `Commande BBDBuy — ${draft.reference}`,
    "",
    `Client: ${draft.customer.firstName} ${draft.customer.lastName}`,
    `Adresse: ${draft.shipping.address1}, ${draft.shipping.postcode} ${draft.shipping.city}, ${draft.shipping.country}`,
    draft.flocageNote ? `\nFlocage:\n${draft.flocageNote}` : "",
    "",
    "Articles:",
    textLines,
    "",
    "Checklist:",
    ...draft.checklist.map((s, i) => `${i + 1}. ${s}`),
    "",
    "https://www.bbdbuy.com",
  ]
    .filter(Boolean)
    .join("\n");

  const result = await sendMail({
    to,
    subject: `[BBDBuy] Commande ${draft.reference} — ${publicConfig.siteName}`,
    html: emailLayout(body),
    text,
  });
  assertMailDelivered(result, `email BBDBuy → ${to}`);
}

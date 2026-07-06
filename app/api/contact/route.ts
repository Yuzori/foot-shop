import { NextResponse } from "next/server";



import { publicConfig } from "@/config";

import { mailConfig } from "@/config/mail";

import {

  emailHeading,

  emailLayout,

  emailParagraph,

} from "@/lib/email-template";

import { sendMail } from "@/lib/mailer";
import { rateLimitOrReject } from "@/lib/rate-limit";



/** Sends a contact-form message to the shop's pro email (config/mail.ts). */

export async function POST(request: Request) {
  const limited = rateLimitOrReject(request, "contact", 8, 60_000);
  if (limited) return limited;

  let body: { name?: string; email?: string; subject?: string; message?: string };

  try {

    body = await request.json();

  } catch {

    return NextResponse.json({ message: "Requête invalide." }, { status: 400 });

  }



  const name = (body.name ?? "").trim();

  const email = (body.email ?? "").trim();

  const subject = (body.subject ?? "").trim();

  const message = (body.message ?? "").trim();



  if (!name || !email || !message) {

    return NextResponse.json(

      { message: "Nom, email et message sont requis." },

      { status: 422 },

    );

  }



  const result = await sendMail({

    to: mailConfig.contactEmail,

    replyTo: email,

    subject: `[Contact ${publicConfig.siteName}] ${subject || "Nouveau message"}`,

    text: `De: ${name} <${email}>\nSujet: ${subject}\n\n${message}`,

    html: emailLayout(`

      ${emailHeading("Nouveau message contact")}

      <p style="margin:0 0 8px;font-size:14px"><strong>De :</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</p>

      <p style="margin:0 0 16px;font-size:14px"><strong>Sujet :</strong> ${escapeHtml(subject)}</p>

      <p style="margin:0;white-space:pre-wrap;font-size:15px;line-height:1.6;color:#333">${escapeHtml(message)}</p>

    `),

  });



  if (!result.delivered && !result.devMode) {

    return NextResponse.json(

      { message: "Impossible d'envoyer le message. Réessayez plus tard." },

      { status: 503 },

    );

  }



  return NextResponse.json({

    message: result.devMode

      ? "Message enregistré (SMTP non configuré — voir console serveur)."

      : "Message envoyé.",

  });

}



function escapeHtml(value: string): string {

  return value

    .replace(/&/g, "&amp;")

    .replace(/</g, "&lt;")

    .replace(/>/g, "&gt;");

}



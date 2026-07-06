import { type Metadata } from "next";

import { ContactForm } from "@/components/contact/contact-form";
import { Container } from "@/components/ui/container";
import { mailConfig } from "@/config/mail";

export const metadata: Metadata = {
  title: "Contact",
  description: "Une question ? Contactez l'équipe.",
};

const channels = [
  { label: "Email", value: mailConfig.contactEmail },
  { label: "Horaires", value: "Lun — Ven · 9h à 18h" },
  { label: "Retours", value: "30 jours pour changer d'avis" },
];

export default function ContactPage() {
  return (
    <Container className="py-16 lg:py-24">
      <div className="grid gap-14 lg:grid-cols-2">
        <div>
          <p className="eyebrow mb-3">Contact</p>
          <h1 className="display-2">Parlons-en</h1>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-ink/60">
            Une question sur un produit, une commande ou le flocage ? Notre
            équipe vous répond rapidement.
          </p>

          <dl className="mt-10 space-y-6">
            {channels.map((channel) => (
              <div key={channel.label}>
                <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/40">
                  {channel.label}
                </dt>
                <dd className="mt-1 text-base">{channel.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="rounded-3xl border border-ink/8 p-8">
          <ContactForm />
        </div>
      </div>
    </Container>
  );
}

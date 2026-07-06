"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Field, TextareaField } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { routes } from "@/config/site";
import { http, getErrorMessage } from "@/lib/http";

/** Contact form — sends the message to the shop's pro email via /api/contact. */
export function ContactForm() {
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    try {
      await http.post("/contact", {
        name: String(form.get("name") ?? ""),
        email: String(form.get("email") ?? ""),
        subject: String(form.get("subject") ?? ""),
        message: String(form.get("message") ?? ""),
      });
      setSent(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-3xl border border-ink/8 bg-paper shadow-soft"
      >
        <div className="h-1.5 bg-accent" aria-hidden />
        <div className="px-8 py-10 text-center sm:px-12 sm:py-12">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-ink text-paper">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              aria-hidden
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h3 className="mt-6 text-xl font-bold tracking-tight text-ink">
            Message envoyé !
          </h3>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-ink/55">
            Merci pour votre message. Notre équipe vous répondra dans les plus
            brefs délais.
          </p>
          <Link
            href={routes.catalogue}
            className="mt-8 inline-flex h-12 items-center justify-center rounded-full bg-ink px-8 text-sm font-semibold text-paper transition-colors hover:bg-ink-soft"
          >
            Revenir à la boutique
          </Link>
        </div>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom" name="name" required autoComplete="name" />
        <Field label="Email" name="email" type="email" required autoComplete="email" />
      </div>
      <Field label="Sujet" name="subject" required />
      <TextareaField label="Message" name="message" required />
      {error ? (
        <p className="rounded-xl bg-accent/10 px-4 py-3 text-sm text-accent">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        size="lg"
        disabled={pending}
        className="flex h-14 min-w-[220px] items-center justify-center"
        aria-busy={pending}
      >
        {pending ? (
          <Spinner className="h-5 w-5" />
        ) : (
          "Envoyer le message"
        )}
      </Button>
    </form>
  );
}

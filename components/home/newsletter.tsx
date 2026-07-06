"use client";



import { useState } from "react";



import { ResponsiveBackground } from "@/components/ui/responsive-background";

import { Button } from "@/components/ui/button";

import { Container } from "@/components/ui/container";

import { http, getErrorMessage } from "@/lib/http";



/** Inscription newsletter — PrestaShop (compte) ou liste invités + email de bienvenue. */

export function Newsletter() {

  const [email, setEmail] = useState("");

  const [done, setDone] = useState(false);

  const [message, setMessage] = useState<string | null>(null);

  const [pending, setPending] = useState(false);



  async function onSubmit(e: React.FormEvent) {

    e.preventDefault();

    const target = email.trim();

    if (!target) return;



    setPending(true);

    setMessage(null);

    try {

      const { data } = await http.post<{ message: string }>("/newsletter", {

        email: target,

      });

      setMessage(data.message);

      setDone(true);

    } catch (err) {

      setMessage(getErrorMessage(err));

    } finally {

      setPending(false);

    }

  }



  return (

    <section className="relative overflow-hidden bg-ink py-24 text-paper">

      <ResponsiveBackground src="/bkd3.jpg" className="opacity-50" />

      <div

        className="absolute inset-0 bg-gradient-to-t from-ink via-ink/70 to-ink/40"

        aria-hidden

      />

      <Container className="relative">

        <div className="mx-auto max-w-2xl text-center">

          <p className="eyebrow text-accent">Newsletter</p>

          <h2 className="display-2 mt-3 text-paper">Restez dans le jeu</h2>

          <p className="mt-4 text-sm leading-relaxed text-paper/70">

            Nouveautés, éditions limitées et offres exclusives. Inscrivez-vous et

            recevez nos meilleures sorties en avant-première.

          </p>



          {done ? (

            <p className="mt-8 text-sm font-medium text-paper">

              {message ?? "Merci ! Votre inscription est bien prise en compte."}

            </p>

          ) : (

            <form
              onSubmit={onSubmit}
              className="mx-auto mt-8 flex w-full max-w-lg flex-col gap-3 px-1 sm:flex-row sm:px-0"
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre@email.com"
                aria-label="Adresse email"
                disabled={pending}
                className="h-12 w-full min-w-0 flex-1 rounded-full border border-paper/25 bg-paper/10 px-5 text-sm text-paper outline-none transition-colors placeholder:text-paper/50 focus:border-paper disabled:opacity-60"
              />

              <Button
                type="submit"
                size="md"
                disabled={pending}
                className="h-12 w-full shrink-0 bg-paper text-ink hover:bg-paper-muted sm:w-auto"
              >

                {pending ? "…" : "S'inscrire"}

              </Button>

            </form>

          )}



          {message && !done ? (

            <p className="mt-4 text-sm text-paper/80">{message}</p>

          ) : null}

        </div>

      </Container>

    </section>

  );

}



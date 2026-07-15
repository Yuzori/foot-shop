"use client";

import { useEffect, useState } from "react";

import { ResponsiveBackground } from "@/components/ui/responsive-background";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { useSession } from "@/hooks/use-auth";
import { http, getErrorMessage } from "@/lib/http";

/** Inscription newsletter — compte PrestaShop ou invité + email de bienvenue. */
export function Newsletter() {
  const { data: user } = useSession();
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (user?.email && !email) {
      setEmail(user.email);
    }
  }, [user?.email, email]);

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
            Nouveautés, éditions limitées et retours en stock. Inscrivez-vous et
            recevez nos meilleures sorties en avant-première.
          </p>
          {user ? (
            <p className="mt-4 text-xs text-paper/55">
              Pas inscrit à la création du compte ? Vous pouvez activer la
              newsletter ici avec votre adresse de connexion.
            </p>
          ) : null}

          {done ? (
            <p className="mt-8 text-sm font-medium text-paper">
              {message ?? "Merci ! Votre inscription est bien prise en compte."}
            </p>
          ) : (
            <form
              onSubmit={onSubmit}
              className="mx-auto mt-8 flex w-full max-w-3xl flex-col gap-3 sm:flex-row sm:items-stretch"
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre@email.com"
                aria-label="Adresse email"
                disabled={pending}
                readOnly={Boolean(user?.email)}
                className="h-14 min-h-[3.5rem] w-full min-w-0 flex-1 rounded-full border border-paper/25 bg-paper/10 px-6 text-base text-paper outline-none transition-colors placeholder:text-paper/50 focus:border-accent focus:bg-paper/15 disabled:opacity-60 read-only:opacity-90 sm:flex-[2]"
              />

              <Button
                type="submit"
                size="lg"
                variant="accent"
                disabled={pending}
                className="h-14 w-full shrink-0 sm:w-auto"
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

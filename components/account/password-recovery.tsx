"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { VerificationCodeHint } from "@/components/account/verification-code-hint";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Field } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { routes } from "@/config/site";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/http";

type Phase = "request" | "verify" | "done";

export function PasswordRecovery() {
  const [phase, setPhase] = useState<Phase>("request");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function requestCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    const value = String(form.get("email") ?? "").trim();
    try {
      await api.forgotPassword({ email: value });
      setEmail(value);
      setInfo(
        "Si un compte existe pour cet email, un code vient d'être envoyé.",
      );
      setPhase("verify");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  async function resetPassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    try {
      await api.resetPassword({
        email,
        code: String(form.get("code") ?? "").trim(),
        password: String(form.get("password") ?? ""),
      });
      setPhase("done");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Container className="py-16 lg:py-24">
      <div className="mx-auto max-w-md">
        <h1 className="display-2 text-center">Mot de passe oublié</h1>

        {phase === "request" ? (
          <>
            <p className="mt-3 text-center text-sm text-ink/55">
              Saisissez votre email pour recevoir un code de réinitialisation.
            </p>
            <form onSubmit={requestCode} className="mt-10 space-y-4">
              <Field label="Email" name="email" type="email" required autoComplete="email" />
              {error ? (
                <p className="rounded-xl bg-accent/10 px-4 py-3 text-sm text-accent">{error}</p>
              ) : null}
              <Button type="submit" size="lg" className="w-full" disabled={pending}>
                {pending ? <Spinner className="h-4 w-4" /> : "Envoyer le code"}
              </Button>
            </form>
          </>
        ) : null}

        {phase === "verify" ? (
          <>
            {info ? (
              <p className="mt-3 text-center text-sm text-ink/55">{info}</p>
            ) : null}
            <div className="mt-6">
              <VerificationCodeHint email={email} />
            </div>
            <form onSubmit={resetPassword} className="mt-8 space-y-4">
              <Field
                label="Code reçu par email"
                name="code"
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
              />
              <Field
                label="Nouveau mot de passe"
                name="password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
              />
              {error ? (
                <p className="rounded-xl bg-accent/10 px-4 py-3 text-sm text-accent">{error}</p>
              ) : null}
              <Button type="submit" size="lg" className="w-full" disabled={pending}>
                {pending ? <Spinner className="h-4 w-4" /> : "Changer mon mot de passe"}
              </Button>
              <button
                type="button"
                onClick={() => setPhase("request")}
                className="block w-full text-center text-xs text-ink/50 hover:text-ink"
              >
                Renvoyer un code
              </button>
            </form>
          </>
        ) : null}

        {phase === "done" ? (
          <div className="mt-10 text-center">
            <p className="text-sm text-ink/70">
              Votre mot de passe a été mis à jour. Un email de confirmation vous a été envoyé.
            </p>
            <Link
              href={routes.login}
              className="mt-6 inline-block font-medium text-ink underline-offset-2 hover:underline"
            >
              Se connecter
            </Link>
          </div>
        ) : null}
      </div>
    </Container>
  );
}

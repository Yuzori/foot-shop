"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { VerificationCodeHint } from "@/components/account/verification-code-hint";
import { setWelcomePromoPending } from "@/components/marketing/welcome-promo-notifier";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Field } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { routes } from "@/config/site";
import { welcomePromo } from "@/config/promotions";
import { useLogin, useRegister, useVerifyRegister } from "@/hooks/use-auth";
import { getErrorMessage } from "@/lib/http";

interface AuthFormProps {
  mode: "login" | "register";
}

type RegisterPhase = "form" | "verify";

export function AuthForm({ mode }: AuthFormProps) {
  const isLogin = mode === "login";
  const router = useRouter();
  const login = useLogin();
  const register = useRegister();
  const verifyRegister = useVerifyRegister();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [registerPhase, setRegisterPhase] = useState<RegisterPhase>("form");
  const [pendingEmail, setPendingEmail] = useState("");

  const pending = login.isPending || register.isPending || verifyRegister.isPending;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);

    try {
      if (isLogin) {
        await login.mutateAsync({
          email: String(form.get("email") ?? ""),
          password: String(form.get("password") ?? ""),
        });
        router.push(routes.account);
        router.refresh();
      } else if (registerPhase === "form") {
        const email = String(form.get("email") ?? "").trim();
        await register.mutateAsync({
          firstName: String(form.get("firstName") ?? ""),
          lastName: String(form.get("lastName") ?? ""),
          email,
          password: String(form.get("password") ?? ""),
          acceptTerms: form.get("acceptTerms") === "on",
          newsletter: form.get("newsletter") === "on",
        });
        setPendingEmail(email);
        setRegisterPhase("verify");
      } else {
        await verifyRegister.mutateAsync({
          email: pendingEmail,
          code: String(form.get("code") ?? "").trim(),
        });
        setWelcomePromoPending();
        setSuccess(true);
        setTimeout(() => {
          router.push(routes.account);
          router.refresh();
        }, 1400);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  if (success) {
    return (
      <Container className="py-24">
        <div className="mx-auto max-w-md text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-ink text-paper">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <h1 className="display-2 mt-6">Compte créé !</h1>
          {welcomePromo.enabled ? (
            <div className="mt-6 rounded-2xl border border-ink/10 bg-paper-soft px-6 py-5">
              <p className="text-xs font-bold uppercase tracking-widest text-accent">
                Votre cadeau de bienvenue
              </p>
              <p className="mt-3 font-display text-3xl font-semibold">
                {welcomePromo.label}
              </p>
              <p className="mt-2 text-sm text-ink/60">
                Sur votre première commande — le {welcomePromo.checkoutLabel.toLowerCase()}{" "}
                s&apos;applique automatiquement au paiement (3 articles minimum).
              </p>
            </div>
          ) : null}
          <p className="mt-4 text-sm text-ink/60">
            Un email de confirmation vous a été envoyé. Redirection…
          </p>
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-16 lg:py-24">
      <div className="mx-auto max-w-md">
        <h1 className="display-2 text-center">
          {isLogin
            ? "Connexion"
            : registerPhase === "verify"
              ? "Vérifiez votre email"
              : "Créer un compte"}
        </h1>
        <p className="mt-3 text-center text-sm text-ink/55">
          {isLogin
            ? "Accédez à vos commandes et vos informations."
            : registerPhase === "verify"
              ? `Saisissez le code envoyé à ${pendingEmail}`
              : "Rejoignez la boutique et suivez vos commandes."}
        </p>

        {!isLogin && registerPhase === "verify" ? (
          <div className="mt-6">
            <VerificationCodeHint email={pendingEmail} />
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          {!isLogin && registerPhase === "form" ? (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Prénom" name="firstName" required autoComplete="given-name" />
              <Field label="Nom" name="lastName" required autoComplete="family-name" />
            </div>
          ) : null}

          {isLogin || registerPhase === "form" ? (
            <>
              <Field label="Email" name="email" type="email" required autoComplete="email" />
              <Field
                label="Mot de passe"
                name="password"
                type="password"
                required
                minLength={6}
                autoComplete={isLogin ? "current-password" : "new-password"}
              />
            </>
          ) : (
            <Field
              label="Code de vérification"
              name="code"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
            />
          )}

          {isLogin ? (
            <div className="text-right">
              <Link
                href={routes.forgot}
                className="text-xs text-ink/55 underline-offset-2 hover:text-ink hover:underline"
              >
                Mot de passe oublié ?
              </Link>
            </div>
          ) : registerPhase === "form" ? (
            <div className="space-y-3 pt-1">
              <label className="flex items-start gap-3 text-xs leading-relaxed text-ink/70">
                <input
                  type="checkbox"
                  name="acceptTerms"
                  required
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-ink/30 accent-ink"
                />
                <span>
                  J&apos;accepte les{" "}
                  <Link href={routes.terms} className="underline underline-offset-2">
                    conditions générales
                  </Link>{" "}
                  et la{" "}
                  <Link href={routes.privacy} className="underline underline-offset-2">
                    politique de confidentialité
                  </Link>
                  .
                </span>
              </label>
              <label className="flex items-start gap-3 text-xs leading-relaxed text-ink/70">
                <input
                  type="checkbox"
                  name="newsletter"
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-ink/30 accent-ink"
                />
                <span>
                  Je souhaite recevoir les nouveautés et offres exclusives par email.
                </span>
              </label>
            </div>
          ) : null}

          {error ? (
            <p className="rounded-xl bg-accent/10 px-4 py-3 text-sm text-accent">{error}</p>
          ) : null}

          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? (
              <Spinner className="h-4 w-4" />
            ) : isLogin ? (
              "Se connecter"
            ) : registerPhase === "verify" ? (
              "Valider mon compte"
            ) : (
              "Créer mon compte"
            )}
          </Button>

          {!isLogin && registerPhase === "verify" ? (
            <button
              type="button"
              onClick={() => setRegisterPhase("form")}
              className="block w-full text-center text-xs text-ink/50 hover:text-ink"
            >
              Modifier mes informations
            </button>
          ) : null}
        </form>

        <p className="mt-8 text-center text-sm text-ink/55">
          {isLogin ? "Pas encore de compte ? " : "Déjà inscrit ? "}
          <Link
            href={isLogin ? routes.register : routes.login}
            className="font-medium text-ink underline-offset-2 hover:underline"
          >
            {isLogin ? "Créer un compte" : "Se connecter"}
          </Link>
        </p>
      </div>
    </Container>
  );
}

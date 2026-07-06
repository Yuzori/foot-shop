/** Vérifie que les clés Stripe secrète et publique sont du même mode (test ou live). */
export function validateStripeKeyPair(
  secretKey: string,
  publishableKey: string,
): { ok: true } | { ok: false; message: string } {
  const secret = secretKey.trim();
  const publishable = publishableKey.trim();

  if (!secret || !publishable) {
    return {
      ok: false,
      message:
        "Clés Stripe manquantes. Définissez STRIPE_SECRET_KEY et NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY dans .env.local.",
    };
  }

  const secretMode = secret.startsWith("sk_live_")
    ? "live"
    : secret.startsWith("sk_test_")
      ? "test"
      : null;
  const publishableMode = publishable.startsWith("pk_live_")
    ? "live"
    : publishable.startsWith("pk_test_")
      ? "test"
      : null;

  if (!secretMode || !publishableMode) {
    return {
      ok: false,
      message:
        "Format de clé Stripe invalide (attendu sk_test_/pk_test_ ou sk_live_/pk_live_).",
    };
  }

  if (secretMode !== publishableMode) {
    return {
      ok: false,
      message:
        secretMode === "live"
          ? "Vos clés Stripe ne correspondent pas : STRIPE_SECRET_KEY est en mode live (sk_live_) mais NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY est en mode test (pk_test_). Remplacez STRIPE_SECRET_KEY par votre clé sk_test_ (Dashboard Stripe → mode Test → Clés API)."
          : "Vos clés Stripe ne correspondent pas : STRIPE_SECRET_KEY est en mode test mais NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY est en mode live. Utilisez pk_test_ avec sk_test_.",
    };
  }

  return { ok: true };
}

/** Le mode live Stripe refuse localhost — forcer le mode test en local. */
export function validateStripeSiteUrl(
  secretKey: string,
  siteUrl: string,
): { ok: true } | { ok: false; message: string } {
  const isLocal =
    siteUrl.includes("localhost") || siteUrl.includes("127.0.0.1");
  if (isLocal && secretKey.trim().startsWith("sk_live_")) {
    return {
      ok: false,
      message:
        "Impossible d'utiliser des clés Stripe live (sk_live_) sur localhost. Passez en mode Test dans le Dashboard Stripe et utilisez sk_test_ + pk_test_ dans .env.local.",
    };
  }
  return { ok: true };
}

export function getStripePublishableKey(): string {
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? "";
}

export function formatStripeError(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return "Erreur Stripe inconnue.";
}

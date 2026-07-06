interface VerificationCodeHintProps {
  email?: string;
}

/** Rappel + ouverture de la messagerie. */
export function VerificationCodeHint({ email }: VerificationCodeHintProps) {
  const mailto = email
    ? `mailto:${encodeURIComponent(email)}`
    : "mailto:";

  return (
    <div className="rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <p className="font-semibold">Vérifiez votre boîte mail</p>
      <p className="mt-1 text-xs leading-relaxed text-amber-900/80">
        Le code peut mettre 1 à 2 minutes à arriver.
      </p>
      <a
        href={mailto}
        className="mt-3 inline-flex items-center justify-center rounded-full bg-ink px-4 py-2 text-xs font-semibold text-paper transition-colors hover:bg-ink-soft"
      >
        Ouvrir ma messagerie
      </a>
    </div>
  );
}

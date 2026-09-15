import Link from "next/link";
import { type Metadata } from "next";

import { ArticlePage } from "@/components/common/article-page";
import { buttonClasses } from "@/components/ui/button";
import { routes } from "@/config/site";

export const metadata: Metadata = {
  title: "Connexion VPN détectée",
  robots: { index: false, follow: false },
};

export default function VpnBlockedPage() {
  return (
    <ArticlePage
      eyebrow="Accès restreint"
      title="Veuillez désactiver votre VPN"
      intro="Pour des raisons de sécurité et de prévention des abus sur les offres promotionnelles, l'accès au site n'est pas disponible via un VPN ou un proxy."
    >
      <section className="space-y-4 text-sm text-ink/70">
        <p>
          Désactivez votre VPN ou votre extension de confidentialité, puis
          rechargez la page d&apos;accueil.
        </p>
        <Link href={routes.home} className={buttonClasses("primary", "md", "inline-flex")}>
          Réessayer
        </Link>
      </section>
    </ArticlePage>
  );
}

import Link from "next/link";

import { buttonClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { routes } from "@/config/site";

export default function NotFound() {
  return (
    <Container className="flex min-h-[70vh] flex-col items-center justify-center py-24 text-center">
      <p className="display-1 leading-none text-ink/10">404</p>
      <h1 className="display-2 -mt-4">Page introuvable</h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-ink/55">
        La page que vous cherchez n&apos;existe pas ou a été déplacée.
      </p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Link href={routes.home} className={buttonClasses("primary", "md")}>
          Retour à l&apos;accueil
        </Link>
        <Link
          href={routes.catalogue}
          className={buttonClasses("outline", "md")}
        >
          Voir la boutique
        </Link>
      </div>
    </Container>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ArrowIcon } from "@/components/layout/icons";
import { Button, buttonClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Spinner } from "@/components/ui/spinner";
import { routes } from "@/config/site";
import { useLogout, useSession } from "@/hooks/use-auth";

const tiles = [
  {
    title: "Mes commandes",
    description: "Historique et statut de vos commandes.",
    href: routes.orders,
  },
  {
    title: "Suivi de commande",
    description: "Suivez une commande avec sa référence.",
    href: routes.tracking,
  },
  {
    title: "Mes favoris",
    description: "Retrouvez les produits que vous aimez.",
    href: routes.favorites,
  },
  {
    title: "Assistance",
    description: "Une question ? Contactez notre équipe.",
    href: routes.contact,
  },
];

export function AccountView() {
  const router = useRouter();
  const { data: user, isLoading } = useSession();
  const logout = useLogout();

  if (isLoading) {
    return (
      <Container className="flex min-h-[50vh] items-center justify-center">
        <Spinner className="h-6 w-6" />
      </Container>
    );
  }

  return (
    <Container className="py-12 lg:py-16">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow mb-3">Espace client</p>
          <h1 className="display-2">
            {user ? `Bonjour, ${user.firstName}` : "Mon compte"}
          </h1>
          {user ? (
            <p className="mt-2 text-sm text-ink/55">{user.email}</p>
          ) : null}
        </div>

        {user ? (
          <Button
            variant="outline"
            onClick={async () => {
              await logout.mutateAsync();
              router.refresh();
            }}
            disabled={logout.isPending}
          >
            {logout.isPending ? <Spinner className="h-4 w-4" /> : "Se déconnecter"}
          </Button>
        ) : (
          <Link href={routes.login} className={buttonClasses("primary", "md")}>
            Se connecter
          </Link>
        )}
      </div>

      {!user ? (
        <p className="mt-6 max-w-md text-sm leading-relaxed text-ink/55">
          Connectez-vous ou créez un compte pour retrouver vos commandes et
          accélérer vos achats.
        </p>
      ) : null}

      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        {tiles.map((tile) => (
          <Link
            key={tile.href}
            href={tile.href}
            className="group flex items-center justify-between rounded-2xl border border-ink/8 p-7 transition-colors hover:border-ink/20 hover:bg-paper-soft"
          >
            <div>
              <h2 className="text-lg font-semibold tracking-tightest">
                {tile.title}
              </h2>
              <p className="mt-1 text-sm text-ink/55">{tile.description}</p>
            </div>
            <ArrowIcon className="shrink-0 text-ink/40 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-ink" />
          </Link>
        ))}
      </div>
    </Container>
  );
}

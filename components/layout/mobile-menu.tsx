"use client";



import { AnimatePresence, motion } from "framer-motion";

import Link from "next/link";

import { useState } from "react";



import { LeagueIcon } from "@/components/layout/league-icon";

import {
  buildCatalogHref,
  catalogAudiences,
  catalogLeagues,
  type CatalogNavCategories,
} from "@/config/catalog-leagues";

import { CloseIcon, TrophyIcon } from "@/components/layout/icons";

import { primaryNav, routes } from "@/config/site";

import { worldCupConfig } from "@/config/world-cup";

import { useCatalogNav } from "@/hooks/use-catalog-nav";

import { cn } from "@/lib/utils";



interface MobileMenuProps {

  open: boolean;

  onClose: () => void;

}



const accountLinks = [

  { label: "Connexion", href: routes.login },

  { label: "Mon compte", href: routes.account },

  { label: "Mes favoris", href: routes.favorites },

  { label: "Suivi de commande", href: routes.tracking },

];



export function MobileMenu({ open, onClose }: MobileMenuProps) {

  const catalogNav = useCatalogNav();



  return (

    <AnimatePresence>

      {open ? (

        <motion.div

          initial={{ opacity: 0 }}

          animate={{ opacity: 1 }}

          exit={{ opacity: 0 }}

          className="fixed inset-0 z-[60] lg:hidden"

        >

          <div

            className="absolute inset-0 bg-ink/30 backdrop-blur-xl"

            onClick={onClose}

          />

          <motion.nav

            initial={{ x: "100%" }}

            animate={{ x: 0 }}

            exit={{ x: "100%" }}

            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}

            className="absolute right-0 top-0 flex h-full w-[85%] max-w-sm flex-col bg-paper p-6 pb-10"

          >

            <div className="flex items-center justify-between">

              <span className="text-lg font-semibold tracking-tightest">Menu</span>

              <button onClick={onClose} aria-label="Fermer le menu">

                <CloseIcon />

              </button>

            </div>



            <div className="mt-10 flex flex-col gap-1">

              {worldCupConfig.enabled ? (
                <Link
                  href={worldCupConfig.href}
                  onClick={onClose}
                  className={cn(
                    "group relative mb-4 flex items-center justify-center gap-2 overflow-hidden rounded-full bg-ink px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.16em] text-paper",
                    "transition-[transform,background-color] duration-300 hover:scale-[1.02] hover:bg-accent",
                  )}
                >
                  <TrophyIcon className="h-4 w-4 shrink-0" />
                  {worldCupConfig.label}
                </Link>
              ) : null}

              <MobileCatalogGroup
                label={catalogNav.maillots.label}
                kind="jersey"
                categories={catalogNav.categories}
                allCategories={catalogNav.allCategories}
                onClose={onClose}
              />
              <MobileCatalogGroup
                label={catalogNav.shorts.label}
                kind="short"
                categories={catalogNav.categories}
                allCategories={catalogNav.allCategories}
                onClose={onClose}
              />

              {primaryNav.map((link) => (

                <Link

                  key={link.href}

                  href={link.href}

                  prefetch={false}

                  onClick={onClose}

                  className="border-b border-ink/5 py-4 text-2xl font-medium tracking-tightest"

                >

                  {link.label}

                </Link>

              ))}

            </div>



            <div className="mt-auto flex flex-col gap-3 pt-8">

              {accountLinks.map((link) => (

                <Link

                  key={link.href}

                  href={link.href}

                  onClick={onClose}

                  className="text-sm text-ink/60"

                >

                  {link.label}

                </Link>

              ))}

            </div>

          </motion.nav>

        </motion.div>

      ) : null}

    </AnimatePresence>

  );

}



function MobileCatalogGroup({

  label,

  kind,

  categories,

  allCategories = [],

  onClose,

}: {

  label: string;

  kind: "jersey" | "short";

  categories: CatalogNavCategories;

  allCategories?: import("@/types/domain").Category[];

  onClose: () => void;

}) {

  const [open, setOpen] = useState(false);



  return (

    <div className="border-b border-ink/5 py-2">

      <button

        type="button"

        onClick={() => setOpen((v) => !v)}

        className="flex w-full items-center justify-between py-3 text-2xl font-medium tracking-tightest"

      >

        {label}

        <motion.span

          animate={{ rotate: open ? 45 : 0 }}

          transition={{ duration: 0.2 }}

          className="text-lg text-ink/40"

        >

          +

        </motion.span>

      </button>

      <AnimatePresence initial={false}>

        {open ? (

          <motion.div

            initial={{ height: 0, opacity: 0 }}

            animate={{ height: "auto", opacity: 1 }}

            exit={{ height: 0, opacity: 0 }}

            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}

            className="overflow-hidden"

          >

            <div className="space-y-4 pb-4 pl-1">

              {catalogAudiences.map((audience) => (

                <div key={audience.id}>

                  <p className="text-xs font-bold uppercase tracking-widest text-ink/40">

                    {audience.label}

                  </p>

                  <ul className="mt-2 space-y-2">

                    {catalogLeagues.map((league) => (

                      <li key={`${audience.id}-${league.id}`}>

                        <Link

                          href={buildCatalogHref(
                            kind,
                            audience.id,
                            league,
                            categories,
                            allCategories,
                          )}

                          onClick={onClose}

                          className="flex items-center gap-2 text-sm text-ink/75"

                        >

                          <LeagueIcon src={league.icon} label={league.label} />

                          {league.label}

                        </Link>

                      </li>

                    ))}

                  </ul>

                </div>

              ))}

            </div>

          </motion.div>

        ) : null}

      </AnimatePresence>

    </div>

  );

}



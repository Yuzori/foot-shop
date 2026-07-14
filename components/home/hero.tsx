"use client";



import Link from "next/link";

import { motion } from "framer-motion";



import { ResponsiveBackground } from "@/components/ui/responsive-background";

import { buttonClasses } from "@/components/ui/button";

import { Container } from "@/components/ui/container";

import { useCatalogNav } from "@/hooks/use-catalog-nav";



const ease = [0.16, 1, 0.3, 1] as const;



/** Hero d'accueil — fond image pleine hauteur, sans fondu bas. */

export function Hero() {

  const catalogNav = useCatalogNav();



  return (

    <section className="relative overflow-hidden bg-ink text-paper">

      <ResponsiveBackground src="/bkd.jpg" />

      <div

        className="absolute inset-0 bg-gradient-to-r from-ink/75 via-ink/35 to-ink/10"

        aria-hidden

      />

      <div

        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_20%_80%,rgba(102,186,255,0.22),transparent)]"

        aria-hidden

      />



      <Container className="relative flex min-h-[54vh] flex-col justify-center py-16 sm:min-h-[58vh] sm:py-20">

        <motion.p

          initial={{ opacity: 0, y: 12 }}

          animate={{ opacity: 1, y: 0 }}

          transition={{ duration: 0.6, ease }}

          className="eyebrow text-accent"

        >

          Collection officielle · Saison en cours

        </motion.p>



        <h1 className="display-1 mt-6 max-w-4xl text-paper">

          <motion.span

            initial={{ opacity: 0, y: 40 }}

            animate={{ opacity: 1, y: 0 }}

            transition={{ duration: 0.8, ease, delay: 0.1 }}

            className="block"

          >

            Portez les couleurs

          </motion.span>

          <motion.span

            initial={{ opacity: 0, y: 40 }}

            animate={{ opacity: 1, y: 0 }}

            transition={{ duration: 0.8, ease, delay: 0.2 }}

            className="mt-1 block text-accent"

          >

            de la légende.

          </motion.span>

        </h1>



        <motion.p

          initial={{ opacity: 0, y: 16 }}

          animate={{ opacity: 1, y: 0 }}

          transition={{ duration: 0.7, ease, delay: 0.35 }}

          className="mt-8 max-w-xl text-base leading-relaxed text-paper/70"

        >

          Maillots et shorts, éditions limitées et flocage

          personnalisé. Une sélection pensée pour les vrais passionnés.

        </motion.p>



        <motion.div

          initial={{ opacity: 0, y: 16 }}

          animate={{ opacity: 1, y: 0 }}

          transition={{ duration: 0.7, ease, delay: 0.45 }}

          className="mt-12 flex flex-wrap gap-3"

        >

          <Link

            href={catalogNav.maillots.href}

            className={buttonClasses("accent", "lg")}

          >

            Voir les maillots

          </Link>

          <Link

            href={catalogNav.shorts.href}

            className={buttonClasses(

              "outline",

              "lg",

              "border-paper/35 text-paper hover:border-accent hover:bg-accent/15 hover:text-paper",

            )}

          >

            Voir les shorts

          </Link>

        </motion.div>

      </Container>

    </section>

  );

}



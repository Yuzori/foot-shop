import { Reveal } from "@/components/motion/reveal";

import { Container } from "@/components/ui/container";



const items = [

  {

    title: "Qualité garantie",

    description: "Maillots officiels et matières premium, contrôlés un à un.",

  },

  {

    title: "Flocage premium",

    description: "Personnalisation nom & numéro avec finition professionnelle.",

  },

  {

    title: "Livraison soignée",

    description: "Expédition rapide et emballage à la hauteur du produit.",

  },

  {

    title: "Retours simples",

    description: "30 jours pour changer d'avis, sans complication.",

  },

];



/** Static brand value propositions. */

export function ValueProps() {

  return (

    <Container className="py-24">

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

        {items.map((item, i) => (

          <Reveal

            key={item.title}

            delay={i * 0.06}

            className="group relative overflow-hidden rounded-3xl border border-ink/[0.06] bg-paper p-8 shadow-soft transition-all duration-500 hover:-translate-y-1 hover:border-accent/30 hover:shadow-glow-sm"

          >

            <div

              className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-accent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"

              aria-hidden

            />

            <span className="text-sm font-semibold tabular-nums text-accent-dark">

              0{i + 1}

            </span>

            <h3 className="mt-4 text-lg font-semibold tracking-tightest">

              {item.title}

            </h3>

            <p className="mt-2 text-sm leading-relaxed text-ink/55">

              {item.description}

            </p>

          </Reveal>

        ))}

      </div>

    </Container>

  );

}



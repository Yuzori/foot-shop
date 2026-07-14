import { type Metadata } from "next";

import { ArticlePage } from "@/components/common/article-page";

export const metadata: Metadata = {
  title: "À propos",
  description: "Notre passion : le maillot de football, sans compromis.",
};

export default function AboutPage() {
  return (
    <ArticlePage
      eyebrow="Notre histoire"
      title="La passion du maillot"
      intro="Nous sommes une boutique spécialisée dédiée aux maillots de football. Notre obsession : la qualité et une expérience d'achat à la hauteur des plus grandes marques."
    >
      <section>
        <h2>Une sélection exigeante</h2>
        <p>
          Chaque pièce est choisie pour sa qualité. Nous
          travaillons à proposer une sélection claire, lisible et toujours à
          jour, directement issue de notre catalogue officiel.
        </p>
      </section>
      <section>
        <h2>Le détail qui change tout</h2>
        <p>
          Du flocage personnalisé à l&apos;emballage soigné, nous portons une
          attention particulière à chaque étape pour que la réception de votre
          maillot soit à la hauteur de l&apos;attente.
        </p>
      </section>
      <section>
        <h2>Un service à l&apos;écoute</h2>
        <p>
          Une question, un conseil, un suivi de commande : notre équipe reste
          disponible pour vous accompagner avant, pendant et après votre achat.
        </p>
      </section>
    </ArticlePage>
  );
}

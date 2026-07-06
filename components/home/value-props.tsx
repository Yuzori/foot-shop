import { Reveal } from "@/components/motion/reveal";
import { Container } from "@/components/ui/container";

const items = [
  {
    title: "Authenticité garantie",
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
      <div className="grid gap-px overflow-hidden rounded-3xl border border-ink/5 bg-ink/5 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item, i) => (
          <Reveal
            key={item.title}
            delay={i * 0.06}
            className="bg-paper p-8"
          >
            <span className="text-sm font-semibold tabular-nums text-accent">
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

import { type Metadata } from "next";

import { ArticlePage } from "@/components/common/article-page";
import { shopConfig } from "@/config/shop";
import { legalInfo } from "@/config/legal";

export const metadata: Metadata = {
  title: "CGV",
  description: "Conditions générales de vente.",
};

export default function TermsPage() {
  return (
    <ArticlePage
      eyebrow="Cadre contractuel"
      title="Conditions générales de vente"
      intro="Les présentes CGV régissent les ventes conclues sur le site et sont conformes au Code de la consommation. Elles peuvent être modifiées ; la version applicable est celle en vigueur à la date de la commande."
    >
      <section>
        <h2>Article 1 — Objet et acceptation</h2>
        <p>
          Toute commande passée sur le site implique l&apos;acceptation pleine
          et entière des présentes conditions générales de vente. Le client
          déclare en avoir pris connaissance avant de valider sa commande.
        </p>
      </section>

      <section>
        <h2>Article 2 — Produits</h2>
        <p>
          Les produits proposés sont décrits et présentés avec la plus grande
          exactitude possible. Les photographies n&apos;ont pas de valeur
          contractuelle. Les offres sont valables dans la limite des stocks
          disponibles.
        </p>
      </section>

      <section>
        <h2>Article 3 — Prix</h2>
        <p>
          Les prix sont indiqués en euros toutes taxes comprises (TTC), hors
          frais de livraison précisés avant la validation de la commande.
          {" "}{legalInfo.companyName} se réserve le droit de modifier ses prix à
          tout moment, les produits étant facturés sur la base des tarifs en
          vigueur au moment de la commande.
        </p>
      </section>

      <section>
        <h2>Article 4 — Commande</h2>
        <p>
          Le contrat de vente est conclu lorsque le client valide sa commande
          après en avoir vérifié le détail et le prix total. Une confirmation
          lui est adressée par email.
        </p>
      </section>

      <section>
        <h2>Article 5 — Paiement</h2>
        <p>
          Le paiement s&apos;effectue de manière sécurisée au moment de la
          commande par carte bancaire via le prestataire Stripe. Les données
          bancaires sont traitées par ce prestataire et ne sont pas conservées
          par {legalInfo.companyName}.
        </p>
      </section>

      <section>
        <h2>Article 5 bis — Codes promotionnels</h2>
        <p>
          Les codes promotionnels sont personnels, non cumulables sauf mention
          contraire, et utilisables dans la limite de leur validité.{" "}
          {legalInfo.companyName} se réserve le droit d&apos;en modifier ou
          d&apos;en retirer l&apos;usage à tout moment.
        </p>
      </section>

      <section>
        <h2>Article 6 — Livraison</h2>
        <p>
          Les produits sont livrés à l&apos;adresse indiquée par le client lors
          de la commande. Les délais indicatifs sont de 5 à 10 jours ouvrés à
          compter de la confirmation du paiement.
        </p>
        <p>
          {legalInfo.companyName} offre la livraison sur la première commande
          du client. À partir de la deuxième commande, des frais de livraison de{" "}
          {shopConfig.standardShippingPrice.toFixed(2).replace(".", ",")} € TTC
          s&apos;appliquent, indiqués avant validation du paiement.
        </p>
        <p>
          En cas de retard de livraison, le client peut, conformément à
          l&apos;article L.216-6 du Code de la consommation, demander la
          résolution de la vente si le produit n&apos;a pas été livré dans un
          délai supplémentaire raisonnable après mise en demeure.
        </p>
      </section>

      <section>
        <h2>Article 7 — Droit de rétractation</h2>
        <p>
          Conformément aux articles L.221-18 et suivants du Code de la
          consommation, le client dispose d&apos;un délai de{" "}
          {legalInfo.withdrawalDays} jours à compter de la réception des produits
          pour exercer son droit de rétractation, sans avoir à justifier de
          motif. Les produits personnalisés (flocage nom/numéro) sont exclus du
          droit de rétractation conformément à l&apos;article L.221-28.
        </p>
        <p>
          Au-delà du délai légal, {legalInfo.companyName} accepte les retours
          commerciaux pendant {legalInfo.returnDays} jours pour les articles non
          personnalisés, dans leur état et emballage d&apos;origine.
        </p>
      </section>

      <section>
        <h2>Article 8 — Remboursement</h2>
        <p>
          En cas de rétractation, le remboursement intervient dans un délai de 14
          jours après récupération des produits ou preuve de leur expédition, par
          le même moyen de paiement que celui utilisé lors de la commande.
        </p>
      </section>

      <section>
        <h2>Article 9 — Garanties légales</h2>
        <p>
          Tous les produits bénéficient de la garantie légale de conformité
          (articles L.217-3 et suivants du Code de la consommation) et de la
          garantie contre les vices cachés (articles 1641 et suivants du Code
          civil).
        </p>
      </section>

      <section>
        <h2>Article 10 — Médiation</h2>
        <p>
          Conformément aux articles L.612-1 et suivants du Code de la
          consommation, le client peut recourir gratuitement à un médiateur de la
          consommation en vue de la résolution amiable d&apos;un litige :{" "}
          {legalInfo.mediatorName} ({legalInfo.mediatorUrl}).
        </p>
        <p>
          Plateforme européenne de règlement en ligne des litiges :{" "}
          {legalInfo.odrUrl}.
        </p>
      </section>
    </ArticlePage>
  );
}

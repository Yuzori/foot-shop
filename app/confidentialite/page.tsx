import { type Metadata } from "next";

import { ArticlePage } from "@/components/common/article-page";
import { legalInfo } from "@/config/legal";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
};

export default function PrivacyPage() {
  return (
    <ArticlePage
      eyebrow="Vos données"
      title="Politique de confidentialité"
      intro="Conformément au Règlement Général sur la Protection des Données (RGPD) et à la loi Informatique et Libertés, nous attachons une grande importance à la protection de vos données personnelles."
    >
      <section>
        <h2>Responsable du traitement</h2>
        <p>
          {legalInfo.companyName} — {legalInfo.address}. Pour toute question
          relative à vos données : {legalInfo.email}.
        </p>
      </section>

      <section>
        <h2>Données collectées</h2>
        <p>
          Nous collectons uniquement les données nécessaires : identité
          (nom, prénom), coordonnées (email, adresse, téléphone), informations de
          commande et historique d&apos;achat, ainsi que des données techniques
          de navigation (cookies).
        </p>
      </section>

      <section>
        <h2>Finalités et base légale</h2>
        <p>
          Vos données servent à exécuter le contrat de vente (traitement et
          livraison des commandes), à assurer le service client, à respecter nos
          obligations légales et comptables, et — avec votre consentement — à
          vous adresser nos communications commerciales.
        </p>
      </section>

      <section>
        <h2>Durée de conservation</h2>
        <p>
          Les données client sont conservées le temps de la relation commerciale,
          puis archivées conformément aux délais légaux (notamment comptables et
          fiscaux). Les données marketing sont conservées jusqu&apos;au retrait du
          consentement.
        </p>
      </section>

      <section>
        <h2>Destinataires</h2>
        <p>
          Vos données sont destinées à nos services internes et à nos
          sous-traitants (paiement Stripe, transporteurs, hébergement, envoi
          d&apos;emails transactionnels) strictement pour l&apos;exécution de
          leurs prestations. Elles ne sont jamais revendues.
        </p>
      </section>

      <section>
        <h2>Vos droits</h2>
        <p>
          Vous disposez d&apos;un droit d&apos;accès, de rectification,
          d&apos;effacement, de limitation, d&apos;opposition et de portabilité
          de vos données, ainsi que du droit de définir des directives relatives
          à leur sort après votre décès. Vous pouvez exercer ces droits à{" "}
          {legalInfo.email}. Vous pouvez également introduire une réclamation
          auprès de la CNIL (www.cnil.fr).
        </p>
      </section>

      <section>
        <h2>Cookies</h2>
        <p>
          Le site utilise des cookies nécessaires à son fonctionnement et, sous
          réserve de votre consentement, des cookies de mesure d&apos;audience.
          Vous pouvez configurer vos préférences à tout moment via votre
          navigateur.
        </p>
      </section>
    </ArticlePage>
  );
}

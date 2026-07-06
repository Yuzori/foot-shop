import { type Metadata } from "next";

import { ArticlePage } from "@/components/common/article-page";
import { publicConfig } from "@/config";
import { legalInfo } from "@/config/legal";

export const metadata: Metadata = {
  title: "Mentions légales",
  robots: { index: true, follow: true },
};

export default function LegalPage() {
  return (
    <ArticlePage
      eyebrow="Informations"
      title="Mentions légales"
      intro="Conformément à la loi n°2004-575 du 21 juin 2004 pour la confiance dans l'économie numérique (LCEN)."
    >
      <section>
        <h2>Éditeur du site</h2>
        <p>{legalInfo.companyName} — {legalInfo.legalForm}</p>
        <p>Capital social : {legalInfo.shareCapital}</p>
        <p>Siège social : {legalInfo.address}</p>
        <p>SIRET : {legalInfo.siret}</p>
        <p>RCS : {legalInfo.rcs}</p>
        <p>N° TVA intracommunautaire : {legalInfo.vat}</p>
        <p>Email : {legalInfo.email}</p>
        <p>Téléphone : {legalInfo.phone}</p>
      </section>

      <section>
        <h2>Directeur de la publication</h2>
        <p>{legalInfo.publicationDirector}</p>
      </section>

      <section>
        <h2>Hébergement</h2>
        <p>{legalInfo.host}</p>
      </section>

      <section>
        <h2>Propriété intellectuelle</h2>
        <p>
          L&apos;ensemble des contenus présents sur le site {publicConfig.siteName}{" "}
          (textes, images, logos, graphismes) est protégé par le droit de la
          propriété intellectuelle et reste la propriété exclusive de leurs
          titulaires respectifs. Toute reproduction, représentation ou
          exploitation, totale ou partielle, sans autorisation écrite préalable
          est interdite.
        </p>
      </section>

      <section>
        <h2>Responsabilité</h2>
        <p>
          L&apos;éditeur s&apos;efforce d&apos;assurer l&apos;exactitude des
          informations diffusées sur le site, sans pouvoir en garantir
          l&apos;exhaustivité. Les liens vers des sites tiers ne sauraient
          engager sa responsabilité.
        </p>
      </section>

      <section>
        <h2>Médiation et litiges</h2>
        <p>
          Conformément à l&apos;article L.612-1 du Code de la consommation, le
          consommateur peut recourir gratuitement à un médiateur de la
          consommation. La plateforme européenne de Règlement en Ligne des
          Litiges est accessible à l&apos;adresse : {legalInfo.odrUrl}.
        </p>
      </section>
    </ArticlePage>
  );
}

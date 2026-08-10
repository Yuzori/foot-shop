import { publicConfig } from "@/config";
import { routes } from "@/config/site";

/** Données structurées globales (logo, marque, recherche interne). */
export function buildSiteJsonLd() {
  const base = publicConfig.siteUrl.replace(/\/$/, "");
  const logoUrl = `${base}/logo.png`;

  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": `${base}/#organization`,
      name: publicConfig.siteName,
      url: base,
      logo: {
        "@type": "ImageObject",
        url: logoUrl,
        width: 512,
        height: 512,
      },
      image: logoUrl,
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${base}/#website`,
      name: publicConfig.siteName,
      url: base,
      publisher: { "@id": `${base}/#organization` },
      inLanguage: publicConfig.locale,
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${base}${routes.search}?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "OnlineStore",
      "@id": `${base}/#store`,
      name: publicConfig.siteName,
      url: base,
      image: logoUrl,
      priceRange: "€€",
      currenciesAccepted: publicConfig.currency,
      inLanguage: publicConfig.locale,
    },
  ];
}

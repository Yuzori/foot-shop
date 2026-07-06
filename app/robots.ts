import { type MetadataRoute } from "next";

import { publicConfig } from "@/config";

export default function robots(): MetadataRoute.Robots {
  const base = publicConfig.siteUrl.replace(/\/$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/compte",
        "/paiement",
        "/connexion",
        "/creer-compte",
        "/mot-de-passe-oublie",
        "/reinitialiser",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}

import { type MetadataRoute } from "next";

import { publicConfig } from "@/config";
import { routes } from "@/config/site";
import { prestashop } from "@/services/prestashop";

export const revalidate = 3600;

/** Dynamic sitemap: static pages + real products & categories from PrestaShop. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicConfig.siteUrl.replace(/\/$/, "");
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}${routes.catalogue}`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}${routes.categories}`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}${routes.contact}`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}${routes.about}`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}${routes.tracking}`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}${routes.terms}`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}${routes.privacy}`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}${routes.legal}`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];

  if (!prestashop.isConfigured) return staticEntries;

  try {
    const [productsResult, categories] = await Promise.all([
      prestashop.getProducts({ limit: 300, page: 1 }),
      prestashop.getCategories(),
    ]);

    const productEntries: MetadataRoute.Sitemap = productsResult.items.map((p) => ({
      url: `${base}${routes.product(p.id)}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    }));

    const categoryEntries: MetadataRoute.Sitemap = categories.map((c) => ({
      url: `${base}${routes.category(c.id)}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    }));

    return [...staticEntries, ...categoryEntries, ...productEntries];
  } catch {
    return staticEntries;
  }
}

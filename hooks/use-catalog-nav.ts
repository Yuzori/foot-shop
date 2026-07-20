"use client";

import { useMemo } from "react";

import { catalogConfig } from "@/config/catalog";
import { routes } from "@/config/site";
import { useCategories } from "@/hooks/use-categories";
import { resolveCatalogNavCategories } from "@/lib/resolve-catalog-nav";

/** Liens Maillots / Shorts pour la navigation et l'accueil. */
export function useCatalogNav() {
  const { data: categories = [], isLoading } = useCategories();

  return useMemo(() => {
    const navCategories = resolveCatalogNavCategories(categories);
    const { maillotsCategoryId: maillotsId, shortsCategoryId: shortsId } =
      navCategories;

    return {
      isLoading,
      allCategories: categories,
      categories: navCategories,
      maillots: {
        label: catalogConfig.maillots.label,
        categoryId: maillotsId,
        href: routes.catalogHub({ kind: "jersey" }),
      },
      shorts: {
        label: catalogConfig.shorts.label,
        categoryId: shortsId,
        href: routes.catalogHub({ kind: "short" }),
      },
      kidsMaillots: {
        label: catalogConfig.kidsMaillots.label,
        categoryId: navCategories.kidsMaillotsCategoryId,
        href: routes.catalogHub({ kind: "jersey", audience: "kids" }),
      },
      kidsShorts: {
        label: catalogConfig.kidsShorts.label,
        categoryId: navCategories.kidsShortsCategoryId,
        href: routes.catalogHub({ kind: "short", audience: "kids" }),
      },
    };
  }, [categories]);
}

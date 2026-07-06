"use client";

import { useMemo } from "react";

import { catalogConfig } from "@/config/catalog";
import type { CatalogNavCategories } from "@/config/catalog-leagues";
import {
  findCategoryIdByMatcher,
  matchKidsMaillotsCategory,
  matchKidsShortsCategory,
} from "@/lib/catalog-category-match";
import { routes } from "@/config/site";
import { useCategories } from "@/hooks/use-categories";
import type { Category } from "@/types/domain";

function findCategoryId(
  categories: Category[],
  patterns: string[],
  excludeIds: string[] = [],
): string {
  const match = categories.find((c) => {
    if (excludeIds.includes(c.id)) return false;
    const name = c.name.toLowerCase();
    return patterns.some((p) => new RegExp(`\\b${p}\\b`, "i").test(name));
  });
  return match?.id ?? "";
}

/** Liens Maillots / Shorts pour la navigation et l'accueil. */
export function useCatalogNav() {
  const { data: categories = [], isLoading } = useCategories();

  return useMemo(() => {
    const maillotsId =
      catalogConfig.maillots.categoryId ||
      findCategoryId(categories, ["maillot", "jersey", "kit"]);
    const shortsId =
      catalogConfig.shorts.categoryId ||
      findCategoryId(categories, ["short", "shorts"], maillotsId ? [maillotsId] : []);
    const kidsMaillotsId =
      catalogConfig.kidsMaillots.categoryId ||
      findCategoryIdByMatcher(categories, matchKidsMaillotsCategory, shortsId
        ? [shortsId]
        : []);
    const kidsShortsId =
      catalogConfig.kidsShorts.categoryId ||
      findCategoryIdByMatcher(
        categories,
        matchKidsShortsCategory,
        [maillotsId, kidsMaillotsId].filter(Boolean),
      );

    const navCategories: CatalogNavCategories = {
      maillotsCategoryId: maillotsId,
      shortsCategoryId: shortsId,
      kidsMaillotsCategoryId: kidsMaillotsId,
      kidsShortsCategoryId: kidsShortsId,
    };

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
        categoryId: kidsMaillotsId,
        href: routes.catalogHub({ kind: "jersey", audience: "kids" }),
      },
      kidsShorts: {
        label: catalogConfig.kidsShorts.label,
        categoryId: kidsShortsId,
        href: routes.catalogHub({ kind: "short", audience: "kids" }),
      },
    };
  }, [categories]);
}

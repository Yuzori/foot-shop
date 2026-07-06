import { Suspense } from "react";
import { type Metadata } from "next";

import { CategoryDetailView } from "@/components/category/category-detail-view";
import { prestashop } from "@/services/prestashop";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const category = await prestashop.getCategoryById(id);
  if (!category) return { title: "Catégorie" };
  return {
    title: category.name,
    description:
      category.description.replace(/<[^>]*>/g, "").slice(0, 160) ||
      `Maillots de la catégorie ${category.name}.`,
  };
}

export default async function CategoryPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <Suspense fallback={null}>
      <CategoryDetailView id={id} />
    </Suspense>
  );
}

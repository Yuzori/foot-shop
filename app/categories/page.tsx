import { Suspense } from "react";
import { type Metadata } from "next";

import { CatalogHub } from "@/components/category/catalog-hub";
import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Collections",
  description: "Parcourez maillots et shorts par taille et par division.",
};

function CatalogHubFallback() {
  return (
    <Container className="py-12 lg:py-20">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="mt-4 h-4 w-96" />
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    </Container>
  );
}

export default function CategoriesPage() {
  return (
    <Suspense fallback={<CatalogHubFallback />}>
      <CatalogHub />
    </Suspense>
  );
}

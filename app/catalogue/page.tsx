import { type Metadata } from "next";
import { Suspense } from "react";

import { CatalogueClient } from "./catalogue-client";

export const metadata: Metadata = {
  title: "Boutique",
  description:
    "Tous les maillots de football : clubs, sélections nationales et éditions limitées.",
};

export default function CataloguePage() {
  return (
    <Suspense>
      <CatalogueClient />
    </Suspense>
  );
}

import { type Metadata } from "next";
import { Suspense } from "react";

import { SearchView } from "@/components/search/search-view";

export const metadata: Metadata = {
  title: "Recherche",
  description: "Trouvez votre maillot parmi notre catalogue.",
};

export default function SearchPage() {
  return (
    <Suspense>
      <SearchView />
    </Suspense>
  );
}

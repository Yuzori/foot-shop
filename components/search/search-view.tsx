"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { SearchIcon } from "@/components/layout/icons";
import { ProductGrid } from "@/components/product/product-grid";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { useDebounce } from "@/hooks/use-debounce";
import { useSearch } from "@/hooks/use-search";

/** Live search experience with debounced querying. */
export function SearchView() {
  const router = useRouter();
  const params = useSearchParams();
  const initial = params.get("q") ?? "";

  const [term, setTerm] = useState(initial);
  const debounced = useDebounce(term, 350);
  const { data, isLoading, isError } = useSearch(debounced);

  useEffect(() => {
    const query = debounced.trim();
    const next = query ? `/recherche?q=${encodeURIComponent(query)}` : "/recherche";
    router.replace(next, { scroll: false });
  }, [debounced, router]);

  const results = data ?? [];
  const hasQuery = debounced.trim().length >= 2;
  const showEmpty = hasQuery && !isLoading && results.length === 0;

  return (
    <Container className="py-12 lg:py-20">
      <div className="mx-auto max-w-2xl">
        <h1 className="display-2 text-center">Rechercher</h1>
        <div className="relative mt-8">
          <SearchIcon className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-ink/40" />
          <input
            autoFocus
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Maillot, club, équipe nationale…"
            className="h-16 w-full rounded-full border border-ink/15 bg-paper pl-14 pr-6 text-base outline-none transition-colors focus:border-ink"
            aria-label="Rechercher un produit"
          />
        </div>
      </div>

      <div className="mt-16">
        {!hasQuery ? (
          <p className="text-center text-sm text-ink/40">
            Saisissez au moins 2 caractères pour lancer la recherche.
          </p>
        ) : showEmpty ? (
          <EmptyState
            title={isError ? "Recherche indisponible" : "Aucun résultat"}
            description={
              isError
                ? "La connexion au back office a échoué."
                : `Nous n'avons rien trouvé pour « ${debounced} ».`
            }
          />
        ) : (
          <ProductGrid products={results} loading={isLoading} skeletonCount={8} />
        )}
      </div>
    </Container>
  );
}

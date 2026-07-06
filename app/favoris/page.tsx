import { type Metadata } from "next";

import { FavoritesView } from "@/components/favorites/favorites-view";

export const metadata: Metadata = {
  title: "Favoris",
  description: "Vos maillots favoris.",
  robots: { index: false, follow: true },
};

export default function FavoritesPage() {
  return <FavoritesView />;
}

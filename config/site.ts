/**
 * Static site configuration: routes and navigation structure.
 * Contains NO product data — only the storefront's own navigation.
 */

export const routes = {
  home: "/",
  catalogue: "/catalogue",
  categories: "/categories",
  category: (id: number | string) => `/categories/${id}`,
  /** Hub de navigation : audience → divisions. */
  catalogHub: (options?: {
    kind?: "jersey" | "short";
    audience?: "adult" | "kids";
  }) => {
    const params = new URLSearchParams();
    if (options?.kind) params.set("kind", options.kind);
    if (options?.audience) params.set("audience", options.audience);
    const qs = params.toString();
    return qs ? `/categories?${qs}` : "/categories";
  },
  product: (id: number | string) => `/produit/${id}`,
  search: "/recherche",
  favorites: "/favoris",
  cart: "/panier",
  checkout: "/paiement",
  login: "/connexion",
  register: "/creer-compte",
  forgot: "/mot-de-passe-oublie",
  reset: "/reinitialiser",
  account: "/compte",
  orders: "/compte/commandes",
  tracking: "/suivi",
  contact: "/contact",
  about: "/a-propos",
  legal: "/mentions-legales",
  privacy: "/confidentialite",
  terms: "/cgv",
} as const;

export type NavLink = {
  label: string;
  href: string;
};

export const primaryNav: NavLink[] = [
  { label: "Collections", href: routes.categories },
  { label: "Nouveautés", href: `${routes.catalogue}?sort=newest` },
  { label: "Contact", href: routes.contact },
];

export const footerNav: { title: string; links: NavLink[] }[] = [
  {
    title: "Collections",
    links: [
      { label: "Maillots", href: `${routes.catalogue}?kind=jersey` },
      { label: "Shorts", href: `${routes.catalogue}?kind=short` },
      { label: "Collections", href: routes.categories },
      { label: "Nouveautés", href: `${routes.catalogue}?sort=newest` },
      { label: "Favoris", href: routes.favorites },
    ],
  },
  {
    title: "Compte",
    links: [
      { label: "Connexion", href: routes.login },
      { label: "Créer un compte", href: routes.register },
      { label: "Mes commandes", href: routes.orders },
      { label: "Suivi de commande", href: routes.tracking },
    ],
  },
  {
    title: "Aide",
    links: [
      { label: "Contact", href: routes.contact },
      { label: "À propos", href: routes.about },
      { label: "CGV", href: routes.terms },
      { label: "Confidentialité", href: routes.privacy },
    ],
  },
];

import { type Metadata } from "next";

import { CartView } from "@/components/cart/cart-view";

export const metadata: Metadata = {
  title: "Panier",
  robots: { index: false, follow: false },
};

export default function CartPage() {
  return <CartView />;
}

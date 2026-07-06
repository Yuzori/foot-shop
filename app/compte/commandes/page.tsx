import { type Metadata } from "next";

import { OrdersView } from "@/components/account/orders-view";

export const metadata: Metadata = {
  title: "Mes commandes",
  robots: { index: false, follow: true },
};

export default function OrdersPage() {
  return <OrdersView />;
}

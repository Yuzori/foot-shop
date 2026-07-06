import { Suspense } from "react";
import { type Metadata } from "next";

import { TrackingView } from "@/components/tracking/tracking-view";

export const metadata: Metadata = {
  title: "Suivi de commande",
  description: "Suivez votre commande avec sa référence.",
};

export default function TrackingPage() {
  return (
    <Suspense fallback={null}>
      <TrackingView />
    </Suspense>
  );
}

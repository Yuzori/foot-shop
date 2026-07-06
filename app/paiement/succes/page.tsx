import { type Metadata } from "next";

import { PaymentSuccessClient } from "@/components/checkout/payment-success-client";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { routes } from "@/config/site";

export const metadata: Metadata = {
  title: "Paiement confirmé",
  robots: { index: false, follow: false },
};

export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; session_id?: string }>;
}) {
  const { ref, session_id: sessionId } = await searchParams;

  return (
    <Container className="py-16 lg:py-24">
      <PaymentSuccessClient sessionId={sessionId} />
      <div className="mx-auto max-w-xl">
        <h1 className="display-2 mb-6 text-center">Merci pour votre commande</h1>
        <EmptyState
          title={ref ? `Paiement confirmé — Référence ${ref}` : "Paiement confirmé"}
          description="Votre paiement a bien été reçu. Votre commande est confirmée et apparaît dans votre espace client. Vous pouvez suivre son avancement à tout moment."
          action={{ label: "Suivre ma commande", href: routes.tracking }}
        />
      </div>
    </Container>
  );
}

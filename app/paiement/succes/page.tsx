import { type Metadata } from "next";

import { PaymentReturnClient } from "@/components/checkout/payment-return-client";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Confirmation de paiement",
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
      <PaymentReturnClient sessionId={sessionId} refParam={ref} />
    </Container>
  );
}

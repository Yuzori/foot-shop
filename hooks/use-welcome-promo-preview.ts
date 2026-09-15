"use client";

import { useQuery } from "@tanstack/react-query";

import { welcomePromo } from "@/config/promotions";

type PromoPreviewResponse = {
  status: "none" | "eligible" | "used";
  enabled: boolean;
  label: string;
  checkoutLabel: string;
  shortLabel: string;
};

type PreviewInput = {
  contact?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };
  address?: {
    address1?: string;
    address2?: string;
    postcode?: string;
    city?: string;
    country?: string;
  };
  customerId?: string;
};

async function fetchWelcomePromoPreview(
  input: PreviewInput,
): Promise<PromoPreviewResponse> {
  const res = await fetch("/api/checkout/welcome-promo-preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error("preview_failed");
  }
  return res.json() as Promise<PromoPreviewResponse>;
}

export function useWelcomePromoPreview(input: PreviewInput | null) {
  const ready = Boolean(
    input?.contact?.email?.trim() &&
      input?.contact?.firstName?.trim() &&
      input?.contact?.lastName?.trim() &&
      input?.contact?.phone?.trim() &&
      input?.address?.address1?.trim() &&
      input?.address?.postcode?.trim() &&
      input?.address?.city?.trim(),
  );

  return useQuery({
    queryKey: ["welcome-promo-preview", input],
    queryFn: () => fetchWelcomePromoPreview(input ?? {}),
    enabled: welcomePromo.enabled && ready,
    staleTime: 30_000,
  });
}

export function shouldApplyWelcomePromoPreview(
  promo: PromoPreviewResponse | undefined,
): boolean {
  return Boolean(welcomePromo.enabled && promo?.status === "eligible");
}

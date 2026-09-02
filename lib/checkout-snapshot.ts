import "server-only";

import {
  getCheckoutPendingByReference,
  type CheckoutPendingRecord,
} from "@/lib/checkout-pending-store";
import {
  getOrderArchiveByReference,
  type OrderArchiveRecord,
} from "@/lib/order-archive-store";

export type CheckoutSnapshot = OrderArchiveRecord | CheckoutPendingRecord;

export async function getCheckoutSnapshotByReference(
  reference: string,
): Promise<CheckoutSnapshot | null> {
  const ref = reference.trim();
  if (!ref) return null;
  return (
    (await getOrderArchiveByReference(ref)) ??
    (await getCheckoutPendingByReference(ref))
  );
}

export function isPaidCheckoutSnapshot(
  snapshot: CheckoutSnapshot,
): snapshot is OrderArchiveRecord {
  return "status" in snapshot && (snapshot.status === "paid" || Boolean(snapshot.paidAt));
}

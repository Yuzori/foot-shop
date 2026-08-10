import { type Metadata } from "next";

import { BbdBuyPanel } from "@/components/admin/bbdbuy-panel";

export const metadata: Metadata = {
  title: "Administration",
  robots: { index: false, follow: false },
};

/** Always serve fresh HTML so JS chunk hashes match the current build. */
export const dynamic = "force-dynamic";

export default function BbdBuyAdminPage() {
  return <BbdBuyPanel />;
}

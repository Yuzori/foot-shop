import { type Metadata } from "next";

import { BbdBuyPanel } from "@/components/admin/bbdbuy-panel";

export const metadata: Metadata = {
  title: "Administration",
  robots: { index: false, follow: false },
};

export default function BbdBuyAdminPage() {
  return <BbdBuyPanel />;
}

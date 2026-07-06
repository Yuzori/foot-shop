import { type Metadata } from "next";

import { AccountView } from "@/components/account/account-view";

export const metadata: Metadata = {
  title: "Mon compte",
  robots: { index: false, follow: true },
};

export default function AccountPage() {
  return <AccountView />;
}

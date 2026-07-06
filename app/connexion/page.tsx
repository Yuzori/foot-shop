import { type Metadata } from "next";

import { AuthForm } from "@/components/account/auth-form";

export const metadata: Metadata = {
  title: "Connexion",
  robots: { index: false, follow: true },
};

export default function LoginPage() {
  return <AuthForm mode="login" />;
}

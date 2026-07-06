import { type Metadata } from "next";

import { AuthForm } from "@/components/account/auth-form";

export const metadata: Metadata = {
  title: "Créer un compte",
  robots: { index: false, follow: true },
};

export default function RegisterPage() {
  return <AuthForm mode="register" />;
}

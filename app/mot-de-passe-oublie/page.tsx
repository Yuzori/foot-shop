import { type Metadata } from "next";

import { PasswordRecovery } from "@/components/account/password-recovery";

export const metadata: Metadata = {
  title: "Mot de passe oublié",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return <PasswordRecovery />;
}

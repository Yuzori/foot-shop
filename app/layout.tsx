import type { Metadata } from "next";
import { Kanit, Poppins } from "next/font/google";

import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { AnnouncementBar } from "@/components/layout/announcement-bar";
import { ClientShell } from "@/components/layout/client-shell";
import { SiteModalHost } from "@/components/marketing/site-modal-host";
import { SiteLoader } from "@/components/layout/site-loader";
import { publicConfig } from "@/config";
import { AppProviders } from "@/providers/app-providers";
import "@/styles/globals.css";

/** Corps de texte — Poppins, propre et lisible. */
const poppins = Poppins({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

/** Titres — Kanit, impact sport sans polices système. */
const kanit = Kanit({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(publicConfig.siteUrl),
  title: {
    default: `${publicConfig.siteName} — Maillots de football premium`,
    template: `%s · ${publicConfig.siteName}`,
  },
  description:
    "Boutique premium de maillots de football. Sélection soignée, éditions limitées et flocage personnalisé.",
  openGraph: {
    type: "website",
    locale: publicConfig.locale,
    siteName: publicConfig.siteName,
  },
  robots: { index: true, follow: true },
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={`${poppins.variable} ${kanit.variable}`}>
      <body className="min-h-screen bg-paper text-ink">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: publicConfig.siteName,
              url: publicConfig.siteUrl,
            }),
          }}
        />
        <SiteLoader />
        <AppProviders>
          <AnnouncementBar />
          <Header />
          <main>{children}</main>
          <Footer />
          <SiteModalHost />
          <ClientShell />
        </AppProviders>
      </body>
    </html>
  );
}

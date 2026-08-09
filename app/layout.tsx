import type { Metadata } from "next";
import { Kanit, Permanent_Marker, Poppins } from "next/font/google";

import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { AnnouncementBar } from "@/components/layout/announcement-bar";
import { ClientShell } from "@/components/layout/client-shell";
import { ChunkErrorRecovery } from "@/components/layout/chunk-error-recovery";
import { SiteModalHost } from "@/components/marketing/site-modal-host";
import { SiteLoader } from "@/components/layout/site-loader";
import { ProductNameMigration } from "@/components/migrations/product-name-migration";
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

/** Brush / peinture — logo & accents header paint. */
const permanentMarker = Permanent_Marker({
  subsets: ["latin"],
  variable: "--font-brush",
  weight: ["400"],
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
    url: publicConfig.siteUrl,
  },
  alternates: {
    canonical: publicConfig.siteUrl,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="fr"
      className={`${poppins.variable} ${kanit.variable} ${permanentMarker.variable}`}
    >
      <head>
        <link
          rel="icon"
          type="image/png"
          href="/icon/ft-white.png"
          media="(prefers-color-scheme: dark)"
        />
        <link
          rel="icon"
          type="image/png"
          href="/icon/ft-black.png"
          media="(prefers-color-scheme: light)"
        />
        <link
          rel="icon"
          type="image/png"
          href="/icon/ft-black.png"
          media="(prefers-color-scheme: no-preference)"
        />
        <link rel="apple-touch-icon" href="/icon/ft-black.png" />
      </head>
      <body className="min-h-screen bg-paper text-ink" suppressHydrationWarning>
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
        <ChunkErrorRecovery />
        <ProductNameMigration />
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

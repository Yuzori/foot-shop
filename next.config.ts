import type { NextConfig } from "next";

/**
 * Build the list of allowed remote image hosts from the environment.
 *
 * The storefront is fully decoupled from PrestaShop: the image host(s) are
 * provided via `PRESTASHOP_IMAGE_HOSTS` (comma separated) so you can plug a
 * different back office later WITHOUT touching any component.
 *
 * Example:
 *   PRESTASHOP_IMAGE_HOSTS="shop.example.com,cdn.example.com"
 */
const imageHosts = (process.env.PRESTASHOP_IMAGE_HOSTS ?? "")
  .split(",")
  .map((host) => host.trim())
  .filter(Boolean);

const remotePatterns = imageHosts.flatMap((hostname) => [
  { protocol: "https" as const, hostname },
  { protocol: "http" as const, hostname },
]);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["sharp"],
  images: {
    // When no host is configured yet, fall back to unoptimized images so the
    // app keeps building/running. Configure PRESTASHOP_IMAGE_HOSTS in prod.
    unoptimized: remotePatterns.length === 0,
    remotePatterns,
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    optimizePackageImports: ["framer-motion", "@tanstack/react-query"],
  },
};

export default nextConfig;

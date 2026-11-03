import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const config: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 2592000,
    remotePatterns: [
      // Cloudflare R2 public bucket — hostname set via R2_PUBLIC_BASE_URL env var.
      // Next.js requires patterns to be declared statically, so we use a wildcard hostname
      // for *.r2.dev and *.cloudflarestorage.com as common R2 public URL patterns.
      // If you have a custom domain for R2, add it here too.
      {
        protocol: "https",
        hostname: "**.r2.dev",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**.cloudflarestorage.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**.spnhealthmix.com",
        pathname: "/**",
      },
      // Vercel Blob (used by Inspo MCP for reference thumbnails — not product images)
      {
        protocol: "https",
        hostname: "**.public.blob.vercel-storage.com",
        pathname: "/**",
      },
    ],
  },
};

export default withSentryConfig(config, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  reactComponentAnnotation: {
    enabled: true,
  },
});

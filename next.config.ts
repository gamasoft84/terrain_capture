import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Raíz del app: carpeta de `package.json` vecino a este `next.config.ts`.
 * No usar solo `dirname(import.meta.url)` ni `process.cwd()` — con el workspace
 * abierto en `cursor_proys` Turbopack/PostCSS puede resolver deps en el padre y fallar en `tailwindcss`.
 */
const require = createRequire(import.meta.url);
const configDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.dirname(
  require.resolve("./package.json", { paths: [configDir] }),
);

const nextConfig: NextConfig = {
  // Permite HMR y recursos `/_next/*` cuando entras por túnel (p. ej. cloudflared → *.trycloudflare.com).
  // Sin esto, Next bloquea por origen cruzado respecto a localhost:3000.
  // Añade aquí otros hosts de túnel si usas ngrok, localtunnel, etc.
  allowedDevOrigins: ["*.trycloudflare.com"],
  turbopack: {
    root: projectRoot,
  },
  outputFileTracingRoot: projectRoot,
};

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  extendDefaultRuntimeCaching: true,
  fallbacks: {
    document: "/~offline",
  },
  workboxOptions: {
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/server\.arcgisonline\.com\/.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "terrain-esri-tiles",
          expiration: {
            maxEntries: 2000,
            maxAgeSeconds: 60 * 60 * 24 * 30,
          },
        },
      },
      {
        urlPattern: ({ url }: { url: URL }) =>
          url.hostname.endsWith("supabase.co") &&
          url.pathname.includes("/storage/"),
        handler: "CacheFirst",
        options: {
          cacheName: "terrain-supabase-storage",
          expiration: {
            maxEntries: 500,
            maxAgeSeconds: 60 * 60 * 24 * 7,
          },
        },
      },
    ],
  },
});

export default withPWA(nextConfig);

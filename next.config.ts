import type { NextConfig } from "next";
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

export default nextConfig;

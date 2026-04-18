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
  turbopack: {
    root: projectRoot,
  },
  outputFileTracingRoot: projectRoot,
};

export default nextConfig;

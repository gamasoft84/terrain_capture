#!/usr/bin/env node
/**
 * Generates PWA icons and iOS splash screens from an inline SVG (sharp).
 * Run: node scripts/generate-pwa-assets.mjs
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "public");
const iconsDir = path.join(publicDir, "icons");
const splashDir = path.join(publicDir, "splash");

const BRAND_BG = "#0a0f0d";
const BRAND_FG = "#10b981";

const iconSvg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="${BRAND_BG}"/>
  <circle cx="256" cy="256" r="138" fill="${BRAND_FG}"/>
  <text x="256" y="318" text-anchor="middle" font-family="system-ui,sans-serif" font-size="148" font-weight="700" fill="${BRAND_BG}">TC</text>
</svg>`,
);

const splashSvg = (w, h) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="${BRAND_BG}"/>
  <circle cx="${w / 2}" cy="${h / 2 - 40}" r="${Math.min(w, h) * 0.12}" fill="${BRAND_FG}"/>
  <text x="${w / 2}" y="${h / 2 + 120}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="${Math.min(w, h) * 0.07}" font-weight="600" fill="${BRAND_FG}">TerrainCapture</text>
  <text x="${w / 2}" y="${h / 2 + 220}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="${Math.min(w, h) * 0.032}" fill="#a7b3af">Sin conexión</text>
</svg>`,
);

async function writeSplash(w, h, filename) {
  const outPath = path.join(splashDir, filename);
  await sharp(splashSvg(w, h)).png().toFile(outPath);
  console.log(`Wrote ${path.relative(root, outPath)}`);
}

async function main() {
  await fs.mkdir(iconsDir, { recursive: true });
  await fs.mkdir(splashDir, { recursive: true });

  await sharp(iconSvg).resize(512, 512).png().toFile(path.join(iconsDir, "icon-512.png"));
  console.log(`Wrote public/icons/icon-512.png`);

  await sharp(iconSvg).resize(192, 192).png().toFile(path.join(iconsDir, "icon-192.png"));
  console.log(`Wrote public/icons/icon-192.png`);

  await sharp(iconSvg).resize(180, 180).png().toFile(path.join(iconsDir, "apple-touch-icon.png"));
  console.log(`Wrote public/icons/apple-touch-icon.png`);

  // Maskable uses extra padding — same art, slightly smaller circle in a 512 safe zone (spec min 512)
  const maskableSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${BRAND_BG}"/>
  <circle cx="256" cy="256" r="118" fill="${BRAND_FG}"/>
  <text x="256" y="298" text-anchor="middle" font-family="system-ui,sans-serif" font-size="126" font-weight="700" fill="${BRAND_BG}">TC</text>
</svg>`,
  );
  await sharp(maskableSvg).resize(512, 512).png().toFile(path.join(iconsDir, "icon-maskable-512.png"));
  console.log(`Wrote public/icons/icon-maskable-512.png`);

  /* Common iPhone portrait splash sizes (points × scale → pixels) */
  await writeSplash(1170, 2532, "launch-1170x2532.png"); // 12/13 Pro, 14
  await writeSplash(1284, 2778, "launch-1284x2778.png"); // 14 Pro Max, Plus
  await writeSplash(1125, 2436, "launch-1125x2436.png"); // X / XS / 11 Pro

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

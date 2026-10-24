// Gera favicon e ícones do app (PWA) a partir do símbolo da marca (trigo).
// Uso: node scripts/gerar-icones.mjs
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";

const WHEAT = [
  "M2 22 16 8",
  "M3.47 12.53 5 11l1.53 1.53a3.5 3.5 0 0 1 0 4.94L5 19l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z",
  "M7.47 8.53 9 7l1.53 1.53a3.5 3.5 0 0 1 0 4.94L9 15l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z",
  "M11.47 4.53 13 3l1.53 1.53a3.5 3.5 0 0 1 0 4.94L13 11l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z",
  "M20 2h2v2a4 4 0 0 1-4 4h-2V6a4 4 0 0 1 4-4Z",
  "M11.47 17.47 13 19l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L5 19l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z",
  "M15.47 13.47 17 15l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L9 15l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z",
  "M19.47 9.47 21 11l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L13 11l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z",
];
const ACCENT = "#eaaa35";
const INK = "#272b27";

// glyph: fração do lado ocupada pelo trigo; radius: canto (0 = quadrado cheio)
function svg({ size = 512, glyph = 0.62, radius = 0.22 } = {}) {
  const g = size * glyph;
  const off = (size - g) / 2;
  const scale = g / 24;
  const paths = WHEAT.map((d) => `<path d="${d}"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${size * radius}" fill="${ACCENT}"/><g transform="translate(${off} ${off}) scale(${scale})" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</g></svg>`;
}

writeFileSync("src/app/icon.svg", svg({ size: 64, glyph: 0.7, radius: 0.24 }));

const browser = await chromium.launch();
const page = await browser.newPage();
async function png(file, size, opts) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}</style>${svg({ size, ...opts })}`,
  );
  await page.locator("svg").screenshot({ path: file, omitBackground: true });
}
await png("public/icons/icon-192.png", 192, {});
await png("public/icons/icon-512.png", 512, {});
// maskable: fundo cheio e trigo dentro da área segura (80%)
await png("public/icons/maskable-512.png", 512, { glyph: 0.5, radius: 0 });
// iOS arredonda sozinho
await png("src/app/apple-icon.png", 180, { glyph: 0.58, radius: 0 });
await browser.close();
console.log("ícones gerados");

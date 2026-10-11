import html from "../index.html?raw";
const css = Object.values(import.meta.glob("./index.css", { query: "?raw", import: "default", eager: true }))[0] as string;
import sw from "../public/sw.js?raw";
import ofl from "../public/fonts/OFL.txt?raw";

const files = Object.keys(import.meta.glob("../public/fonts/*", { query: "?url" }));

test("Manrope woff2 is self-hosted with its licence", () => {
  expect(files).toContain("../public/fonts/manrope-latin.woff2");
  expect(ofl).toContain("SIL OPEN FONT LICENSE");
});

test("@font-face points at the local file with font-display: swap", () => {
  expect(css).toMatch(/@font-face\s*{[^}]*font-family:\s*"Manrope"[^}]*fonts\/manrope-latin\.woff2[^}]*font-display:\s*swap/s);
});

test("Noto Sans Devanagari is self-hosted, lazy by unicode-range, and precached", () => {
  expect(files).toContain("../public/fonts/noto-sans-devanagari.woff2");
  expect(css).toMatch(/@font-face\s*{[^}]*font-family:\s*"Noto Sans Devanagari"[^}]*fonts\/noto-sans-devanagari\.woff2[^}]*unicode-range:\s*U\+0900-097F[^}]*font-display:\s*swap/s);
  expect(ofl).toContain("Noto Sans Devanagari");
});

test("index.html preloads Manrope and makes no render-blocking Google Fonts requests", () => {
  expect(html).toMatch(/<link rel="preload" href="\.\/fonts\/manrope-latin\.woff2" as="font" type="font\/woff2" crossorigin/);
  expect(html).not.toMatch(/family=Manrope/);
  expect(html).not.toMatch(/googleapis|gstatic/);
});

test("service worker precaches the font", () => {
  expect(sw).toContain("./fonts/manrope-latin.woff2");
});

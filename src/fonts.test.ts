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

test("index.html preloads Manrope and no longer requests it from Google", () => {
  expect(html).toMatch(/<link rel="preload" href="\.\/fonts\/manrope-latin\.woff2" as="font" type="font\/woff2" crossorigin/);
  expect(html).not.toMatch(/family=Manrope/);
  expect(html).toContain("family=Noto+Sans+Devanagari");
});

test("service worker precaches the font", () => {
  expect(sw).toContain("./fonts/manrope-latin.woff2");
});

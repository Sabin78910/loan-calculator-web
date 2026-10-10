import { detectLang, EN, formatDate, formatMoney, loadLang, NE, saveLang, translate } from "./i18n";

beforeEach(() => localStorage.clear());

test("every English key has a non-empty Nepali translation and vice versa", () => {
  expect(Object.keys(NE).sort()).toEqual(Object.keys(EN).sort());
  for (const [k, v] of Object.entries(NE)) expect(v.trim(), k).not.toBe("");
});

test("Nepali placeholders match English placeholders", () => {
  const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
  for (const k of Object.keys(EN) as (keyof typeof EN)[]) expect(ph(NE[k]), k).toEqual(ph(EN[k]));
});

test("translate interpolates params and falls back to English", () => {
  expect(translate("en", "badge", { amount: "1", months: "2" })).toBe("You save NPR 1 and finish 2 months early");
  expect(translate("ne", "title")).toBe(NE.title);
});

test("detects language from navigator.language, stored choice wins", () => {
  expect(detectLang("ne-NP")).toBe("ne");
  expect(detectLang("en-US")).toBe("en");
  expect(detectLang(undefined)).toBe("en");
  saveLang("ne");
  expect(loadLang("en-US")).toBe("ne");
  localStorage.setItem("lang", "xx");
  expect(loadLang("ne")).toBe("ne");
});

test("formats numbers and dates per language", () => {
  expect(formatMoney("en", 1234.5)).toBe("1,234.50");
  expect(formatMoney("ne", 1234.5)).toMatch(/[०-९]/);
  expect(formatDate("ne", new Date(2030, 0, 15))).toMatch(/[०-९]/);
  expect(formatDate("en", new Date(2030, 0, 15))).toBe("January 2030");
});

test("formatMoney without currency or with none keeps bare output", () => {
  expect(formatMoney("en", 1234.5, "none")).toBe("1,234.50");
  expect(formatMoney("en", 1234.5, undefined)).toBe("1,234.50");
});

test.each([["NPR", /NPR|रु|नेरू/], ["INR", /₹/], ["USD", /\$/], ["EUR", /€/], ["GBP", /£/]] as const)("formatMoney shows %s symbol in en and ne", (code, re) => {
  expect(formatMoney("en", 1234.5, code)).toMatch(re);
  expect(formatMoney("en", 1234.5, code)).toMatch(/1,234\.50/);
  const ne = formatMoney("ne", 1234.5, code);
  expect(ne).toMatch(re);
  expect(ne).toMatch(/[०-९]/);
});

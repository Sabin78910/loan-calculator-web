import { loadTheme, saveTheme } from "./theme";

beforeEach(() => localStorage.clear());

test("defaults to dark, follows a light system preference", () => {
  expect(loadTheme(false)).toBe("dark");
  expect(loadTheme(true)).toBe("light");
});

test("saved choice wins and bad values are ignored", () => {
  saveTheme("light");
  expect(loadTheme(false)).toBe("light");
  localStorage.setItem("theme", "neon");
  expect(loadTheme(false)).toBe("dark");
});

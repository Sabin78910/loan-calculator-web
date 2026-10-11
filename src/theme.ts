export type Theme = "dark" | "light";
const KEY = "theme";

/** Saved choice wins; otherwise follow the system, dark-first when it is unknown. */
export function loadTheme(prefersLight: boolean): Theme {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "dark" || saved === "light") return saved;
  } catch { /* storage unavailable */ }
  return prefersLight ? "light" : "dark";
}

export function saveTheme(theme: Theme) {
  try { localStorage.setItem(KEY, theme); } catch { /* storage unavailable */ }
}

export const THEME_COLOR: Record<Theme, string> = { dark: "#070d1a", light: "#f3f6fb" };

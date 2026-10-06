/** The user's theme choice; `system` follows the OS and updates live. */
export type ThemePreference = "system" | "light" | "dark";

const STORAGE_KEY = "shelf.theme";
const media = () => window.matchMedia("(prefers-color-scheme: dark)");

export function getThemePreference(): ThemePreference {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : "system";
}

export function setThemePreference(preference: ThemePreference): void {
  if (preference === "system") localStorage.removeItem(STORAGE_KEY);
  else localStorage.setItem(STORAGE_KEY, preference);
  applyTheme();
}

function applyTheme(): void {
  const preference = getThemePreference();
  const dark = preference === "dark" || (preference === "system" && media().matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

/** Applies the stored theme before the first render and follows OS changes. */
export function initTheme(): void {
  applyTheme();
  media().addEventListener("change", applyTheme);
}

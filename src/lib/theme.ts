// Theme preference — persisted locally and applied before first paint by
// the bootstrap in main.tsx, so there is never a light flash on a dark device.

export type Theme = "light" | "dark" | "system";

const KEY = "gb_theme";

export function getTheme(): Theme {
  if (typeof window === "undefined") return "system";
  const stored = localStorage.getItem(KEY) as Theme | null;
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
}

export function resolveTheme(t: Theme): "light" | "dark" {
  if (t !== "system") return t;
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function applyTheme(t: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", resolveTheme(t) === "dark");
}

export function setTheme(t: Theme) {
  localStorage.setItem(KEY, t);
  applyTheme(t);
  window.dispatchEvent(new CustomEvent("gb:theme", { detail: t }));
}

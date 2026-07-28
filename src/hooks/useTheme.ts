import { useCallback, useEffect, useState } from "react";
import { applyTheme, getTheme, resolveTheme, setTheme as persistTheme, type Theme } from "@/lib/theme";

/**
 * Reads and writes the app theme. Every consumer stays in sync because
 * `setTheme` broadcasts a `gb:theme` event, and system changes are watched too.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => getTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const onTheme = (e: Event) => setThemeState((e as CustomEvent<Theme>).detail);
    window.addEventListener("gb:theme", onTheme as EventListener);

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystem = () => {
      if (getTheme() === "system") applyTheme("system");
    };
    mq.addEventListener("change", onSystem);

    return () => {
      window.removeEventListener("gb:theme", onTheme as EventListener);
      mq.removeEventListener("change", onSystem);
    };
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    persistTheme(t);
  }, []);

  return { theme, resolved: resolveTheme(theme), setTheme };
}

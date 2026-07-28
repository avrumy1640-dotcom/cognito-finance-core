import { useCallback, useEffect, useState } from "react";
import { getCardPrefs, setCardPrefs, type CardPrefs } from "@/lib/cardPrefs";

/** Keeps every screen in sync with locally stored card preferences. */
export function useCardPrefs() {
  const [prefs, setPrefs] = useState<CardPrefs>(() => getCardPrefs());

  useEffect(() => {
    const onChange = (e: Event) => setPrefs((e as CustomEvent<CardPrefs>).detail);
    window.addEventListener("gb:card-prefs", onChange as EventListener);
    return () => window.removeEventListener("gb:card-prefs", onChange as EventListener);
  }, []);

  const update = useCallback((patch: Partial<CardPrefs>) => setPrefs(setCardPrefs(patch)), []);

  return { prefs, update };
}

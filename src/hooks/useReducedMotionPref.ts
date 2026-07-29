import { useCallback, useEffect, useState } from "react";

/**
 * Motion preference: "system" follows prefers-reduced-motion, the other two
 * are explicit user overrides stored locally. The resolved value is mirrored
 * onto <html data-reduced-motion="true"> so global CSS can damp animations.
 */
export type MotionPref = "system" | "reduced" | "full";

const KEY = "gb_motion_pref";
const listeners = new Set<() => void>();

const query = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;

export function getMotionPref(): MotionPref {
  const v = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
  return v === "reduced" || v === "full" ? v : "system";
}

export function resolveReducedMotion(pref: MotionPref = getMotionPref()): boolean {
  if (pref === "reduced") return true;
  if (pref === "full") return false;
  return query()?.matches ?? false;
}

export function applyMotionPref(pref: MotionPref = getMotionPref()) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.reducedMotion = resolveReducedMotion(pref) ? "true" : "false";
}

export function setMotionPref(pref: MotionPref) {
  try {
    localStorage.setItem(KEY, pref);
  } catch {
    /* ignore */
  }
  applyMotionPref(pref);
  listeners.forEach((l) => l());
}

/** Reactive access to both the stored preference and the resolved boolean. */
export function useReducedMotionPref() {
  const [pref, setPref] = useState<MotionPref>(getMotionPref);
  const [reduced, setReduced] = useState<boolean>(() => resolveReducedMotion());

  const sync = useCallback(() => {
    const next = getMotionPref();
    setPref(next);
    setReduced(resolveReducedMotion(next));
    applyMotionPref(next);
  }, []);

  useEffect(() => {
    sync();
    listeners.add(sync);
    const mq = query();
    mq?.addEventListener?.("change", sync);
    window.addEventListener("storage", sync);
    return () => {
      listeners.delete(sync);
      mq?.removeEventListener?.("change", sync);
      window.removeEventListener("storage", sync);
    };
  }, [sync]);

  return { pref, reducedMotion: reduced, setPref: setMotionPref };
}

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Fingerprint, ScanFace, Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import {
  backgroundedTooLong,
  biometricLabel,
  getBiometricKind,
  isAppLockEnabled,
  isUnlockedThisSession,
  markUnlocked,
  touchActivity,
} from "@/lib/appLock";

type Phase = "idle" | "scanning" | "success" | "failed";

/**
 * Full-screen biometric re-entry gate. Rendered above the whole app whenever
 * the customer has app lock switched on and the app was reopened or
 * backgrounded. The scan itself is a demo simulation — the copy says so — but
 * the gating behaviour (session-scoped unlock, re-lock on background) is real.
 */
const AppLock = () => {
  const { user, signOut } = useAuth();
  const { firstName } = useProfile();
  const [locked, setLocked] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const kind = getBiometricKind();
  const label = biometricLabel(kind);
  const timers = useRef<number[]>([]);

  // Decide the initial lock state once we know who is signed in.
  useEffect(() => {
    if (!user) {
      setLocked(false);
      return;
    }
    if (isAppLockEnabled() && !isUnlockedThisSession()) setLocked(true);
  }, [user]);

  // Re-lock after the app has been in the background long enough.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        touchActivity();
        return;
      }
      if (user && isAppLockEnabled() && backgroundedTooLong()) {
        setPhase("idle");
        setLocked(true);
      }
    };
    const onManualLock = () => {
      if (user && isAppLockEnabled()) {
        setPhase("idle");
        setLocked(true);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("gb:applock-lock", onManualLock);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("gb:applock-lock", onManualLock);
    };
  }, [user]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const scan = useCallback(() => {
    if (phase === "scanning") return;
    setPhase("scanning");
    timers.current.push(
      window.setTimeout(() => {
        setPhase("success");
        timers.current.push(
          window.setTimeout(() => {
            markUnlocked();
            setLocked(false);
            setPhase("idle");
          }, 480),
        );
      }, 1200),
    );
  }, [phase]);

  if (!locked || !user) return null;

  const Icon = kind === "face" ? ScanFace : Fingerprint;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-2xl flex flex-col items-center justify-center px-8"
        role="dialog"
        aria-modal="true"
        aria-label={`Unlock Glass Bank with ${label}`}
      >
        <div className="absolute inset-0 gradient-hero opacity-[0.06] pointer-events-none" />

        <div className="relative flex flex-col items-center text-center w-full max-w-xs">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
            <Lock size={12} /> Glass Bank is locked
          </div>

          <h1 className="text-2xl font-display font-bold text-foreground mt-3">
            {firstName ? `Welcome back, ${firstName}` : "Welcome back"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            {phase === "success"
              ? `${label} recognised`
              : phase === "scanning"
                ? `Scanning with ${label}…`
                : `Unlock with ${label} to continue`}
          </p>

          {/* Native-feeling biometric target */}
          <button
            onClick={scan}
            disabled={phase === "scanning" || phase === "success"}
            aria-label={`Unlock with ${label}`}
            className="relative mt-10 w-28 h-28 rounded-[2rem] bg-secondary flex items-center justify-center active:scale-95 transition-transform disabled:active:scale-100"
          >
            <motion.span
              className="absolute inset-0 rounded-[2rem] border-2 border-primary/40"
              animate={
                phase === "scanning"
                  ? { scale: [1, 1.12, 1], opacity: [0.7, 0, 0.7] }
                  : phase === "success"
                    ? { scale: 1, opacity: 1 }
                    : { scale: [1, 1.06, 1], opacity: [0.35, 0.15, 0.35] }
              }
              transition={{ duration: phase === "scanning" ? 1.1 : 2.4, repeat: phase === "success" ? 0 : Infinity }}
            />
            <motion.div
              animate={phase === "success" ? { scale: [1, 1.15, 1] } : {}}
              transition={{ duration: 0.4 }}
            >
              <Icon
                size={46}
                className={phase === "success" ? "text-success" : "text-primary"}
                strokeWidth={1.5}
              />
            </motion.div>
          </button>

          <button
            onClick={scan}
            disabled={phase === "scanning" || phase === "success"}
            className="mt-10 w-full py-3.5 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            {phase === "scanning" ? "Scanning…" : phase === "success" ? "Unlocked" : `Unlock with ${label}`}
          </button>

          <button
            onClick={() => void signOut()}
            className="mt-4 text-xs font-semibold text-muted-foreground"
          >
            Sign in with a different account
          </button>

          <p className="mt-8 text-[11px] text-muted-foreground leading-relaxed">
            Demo build: the {label} prompt is simulated on the web. On a native
            install this uses your device's real biometric sensor.
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AppLock;

// App lock preferences.
//
// SCOPE: this is a *local device lock* — exactly like Face ID on Chime or
// Revolut. It gates re-entry into the app on this device after the app has been
// backgrounded, and on the first load of a new session. It is a demo-grade
// simulation of the native biometric prompt (no WebAuthn assertion required),
// and the UI says so. It is never presented as a server-side auth factor.

const ENABLED_KEY = "gb_biometrics";
const KIND_KEY = "gb_biometric_kind";
const UNLOCKED_KEY = "gb_applock_unlocked"; // sessionStorage — per browser session
const LAST_ACTIVE_KEY = "gb_applock_last_active";

/** How long the app may sit in the background before it re-locks. */
export const RELOCK_AFTER_MS = 60_000;

export type BiometricKind = "face" | "fingerprint";

export function isAppLockEnabled(): boolean {
  return typeof window !== "undefined" && localStorage.getItem(ENABLED_KEY) === "true";
}

export function setAppLockEnabled(enabled: boolean) {
  localStorage.setItem(ENABLED_KEY, String(enabled));
  if (enabled) markUnlocked();
  window.dispatchEvent(new CustomEvent("gb:applock-pref"));
}

export function getBiometricKind(): BiometricKind {
  const stored = localStorage.getItem(KIND_KEY);
  if (stored === "face" || stored === "fingerprint") return stored;
  // Sensible default per platform, matching what the device would really offer.
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  return /iPhone|iPad|Macintosh/.test(ua) ? "face" : "fingerprint";
}

export function setBiometricKind(kind: BiometricKind) {
  localStorage.setItem(KIND_KEY, kind);
  window.dispatchEvent(new CustomEvent("gb:applock-pref"));
}

export function biometricLabel(kind: BiometricKind = getBiometricKind()): string {
  return kind === "face" ? "Face ID" : "Fingerprint";
}

export function markUnlocked() {
  sessionStorage.setItem(UNLOCKED_KEY, "true");
  touchActivity();
}

export function clearUnlocked() {
  sessionStorage.removeItem(UNLOCKED_KEY);
}

export function isUnlockedThisSession(): boolean {
  return sessionStorage.getItem(UNLOCKED_KEY) === "true";
}

export function touchActivity() {
  sessionStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
}

export function backgroundedTooLong(): boolean {
  const raw = Number(sessionStorage.getItem(LAST_ACTIVE_KEY) || "0");
  if (!raw) return false;
  return Date.now() - raw > RELOCK_AFTER_MS;
}

/** Called from Settings' "Lock now" action. */
export function lockNow() {
  clearUnlocked();
  window.dispatchEvent(new CustomEvent("gb:applock-lock"));
}

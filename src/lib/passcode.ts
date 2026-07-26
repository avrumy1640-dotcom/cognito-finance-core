// App passcode — real persistence, no theatre.
//
// The passcode is never stored or transmitted in plain text. We derive a
// PBKDF2-SHA256 hash (210k iterations) with a per-user random salt in the
// browser and store only { salt, hash } in `user_security_settings`, which is
// row-level-secured to the owning user.
//
// Like biometric unlock, this is a *local app lock*: it gates re-entry into the
// app on this device. It is not an additional server-side auth factor and the
// UI does not claim that it is.

import { supabase } from "@/integrations/supabase/client";

const ITERATIONS = 210_000;

const toHex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");

const fromHex = (hex: string) => {
  const buf = new ArrayBuffer(hex.length / 2);
  const out = new Uint8Array(buf);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return buf;
};

async function derive(passcode: string, saltHex: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passcode),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: fromHex(saltHex), iterations: ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );
  return toHex(bits);
}

export interface SecuritySettings {
  biometric_enabled: boolean;
  passcode_hash: string | null;
  passcode_salt: string | null;
}

export async function loadSecuritySettings(userId: string): Promise<SecuritySettings> {
  const { data } = await supabase
    .from("user_security_settings")
    .select("biometric_enabled, passcode_hash, passcode_salt")
    .eq("user_id", userId)
    .maybeSingle();
  return (
    (data as SecuritySettings | null) ?? {
      biometric_enabled: false,
      passcode_hash: null,
      passcode_salt: null,
    }
  );
}

export async function setBiometricEnabled(userId: string, enabled: boolean): Promise<string | null> {
  const { error } = await supabase
    .from("user_security_settings")
    .upsert({ user_id: userId, biometric_enabled: enabled }, { onConflict: "user_id" });
  return error?.message ?? null;
}

export async function setPasscode(userId: string, passcode: string): Promise<string | null> {
  if (!/^\d{4,8}$/.test(passcode)) return "Passcode must be 4–8 digits.";
  const saltHex = toHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  const hash = await derive(passcode, saltHex);
  const { error } = await supabase.from("user_security_settings").upsert(
    {
      user_id: userId,
      passcode_hash: hash,
      passcode_salt: saltHex,
      passcode_updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  return error?.message ?? null;
}

export async function clearPasscode(userId: string): Promise<string | null> {
  const { error } = await supabase
    .from("user_security_settings")
    .upsert(
      { user_id: userId, passcode_hash: null, passcode_salt: null, passcode_updated_at: null },
      { onConflict: "user_id" },
    );
  return error?.message ?? null;
}

export async function verifyPasscode(userId: string, passcode: string): Promise<boolean> {
  const s = await loadSecuritySettings(userId);
  if (!s.passcode_hash || !s.passcode_salt) return false;
  const hash = await derive(passcode, s.passcode_salt);
  return hash === s.passcode_hash;
}

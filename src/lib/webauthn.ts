// WebAuthn biometric unlock.
//
// SCOPE (deliberately honest): this is a *device unlock* control, exactly like
// Face ID on Chime/Revolut. It gates re-entry into the app on this device using
// the platform authenticator. It is NOT a replacement for the Supabase session,
// and we do not claim server-side assertion verification: the credential is
// registered against the signed-in user and stored in `webauthn_credentials`,
// and unlocking requires the platform authenticator to produce an assertion for
// that exact credential id.
//
// If the device has no platform authenticator, `isBiometricAvailable()` returns
// false and the UI hides the control entirely rather than showing a dead toggle.

import { supabase } from "@/integrations/supabase/client";
import { getDeviceId } from "@/lib/deviceTracking";

const b64url = {
  encode(buf: ArrayBuffer): string {
    const bytes = new Uint8Array(buf);
    let s = "";
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  },
  decode(str: string): ArrayBuffer {
    const pad = str.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(pad + "=".repeat((4 - (pad.length % 4)) % 4));
    const buf = new ArrayBuffer(bin.length);
    const out = new Uint8Array(buf);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return buf;
  },

};

export function isWebAuthnSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined" &&
    !!navigator.credentials?.create
  );
}

/** True only when this device exposes a built-in (platform) authenticator. */
export async function isBiometricAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export interface StoredCredential {
  id: string;
  credential_id: string;
  label: string;
  device_id: string | null;
  created_at: string;
  last_used_at: string | null;
}

export async function listCredentials(userId: string): Promise<StoredCredential[]> {
  const { data } = await supabase
    .from("webauthn_credentials")
    .select("id, credential_id, label, device_id, created_at, last_used_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data as StoredCredential[]) ?? [];
}

/** Register the platform authenticator for this user + device. */
export async function registerBiometric(
  userId: string,
  userEmail: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await isBiometricAvailable())) {
    return { ok: false, error: "This device has no built-in biometric authenticator." };
  }
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userIdBytes = new TextEncoder().encode(userId);
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: "Glass Bank", id: window.location.hostname },
        user: { id: userIdBytes, name: userEmail, displayName: userEmail },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          residentKey: "preferred",
        },
        timeout: 60_000,
        attestation: "none",
      },
    })) as PublicKeyCredential | null;

    if (!cred) return { ok: false, error: "Registration was cancelled." };

    const response = cred.response as AuthenticatorAttestationResponse;
    const publicKey = response.getPublicKey?.();
    const { error } = await supabase.from("webauthn_credentials").insert({
      user_id: userId,
      credential_id: b64url.encode(cred.rawId),
      public_key: publicKey ? b64url.encode(publicKey) : null,
      transports: response.getTransports?.() ?? null,
      device_id: getDeviceId(),
      label: navigator.platform || "This device",
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Registration failed";
    return { ok: false, error: msg };
  }
}

/** Prompt the platform authenticator to unlock. */
export async function verifyBiometric(userId: string): Promise<{ ok: boolean; error?: string }> {
  const creds = await listCredentials(userId);
  if (creds.length === 0) return { ok: false, error: "No biometric credential registered." };
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId: window.location.hostname,
        allowCredentials: creds.map((c) => ({
          type: "public-key" as const,
          id: b64url.decode(c.credential_id),
        })),
        userVerification: "required",
        timeout: 60_000,
      },
    })) as PublicKeyCredential | null;
    if (!assertion) return { ok: false, error: "Unlock cancelled." };
    const used = b64url.encode(assertion.rawId);
    await supabase
      .from("webauthn_credentials")
      .update({ last_used_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("credential_id", used);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unlock failed" };
  }
}

export async function removeBiometric(userId: string): Promise<void> {
  await supabase.from("webauthn_credentials").delete().eq("user_id", userId);
}

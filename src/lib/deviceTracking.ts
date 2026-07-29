import { supabase } from "@/integrations/supabase/client";

const DEVICE_KEY = "gb.device_id";

export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export function detectDeviceLabel(ua: string): string {
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android device";
  if (/Macintosh|Mac OS X/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows PC";
  if (/Linux/.test(ua)) return "Linux device";
  return "Browser";
}

/** A device counts as "gone quiet" after this long; a return trip re-alerts. */
const STALE_DEVICE_DAYS = 30;

export async function recordSignIn(userId: string) {
  const ua = navigator.userAgent;
  const label = detectDeviceLabel(ua);
  const deviceId = getDeviceId();
  const now = new Date();

  // Is this browser already known to the account? Real banks only alert on a
  // NEW or long-dormant device — not on every routine sign-in.
  let known: { last_seen_at: string | null } | null = null;
  try {
    const { data } = await supabase
      .from("trusted_devices")
      .select("last_seen_at")
      .eq("user_id", userId)
      .eq("device_id", deviceId)
      .maybeSingle();
    known = data ?? null;
  } catch { /* treat as unknown */ }

  const lastSeen = known?.last_seen_at ? Date.parse(known.last_seen_at) : null;
  const dormant =
    lastSeen !== null && now.getTime() - lastSeen > STALE_DEVICE_DAYS * 24 * 60 * 60 * 1000;
  const isNewDevice = !known;

  // Best-effort — never throw into the auth flow.
  try {
    await supabase.from("login_history").insert({
      user_id: userId,
      user_agent: ua,
      device_label: label,
    });
  } catch { /* ignore */ }

  try {
    await supabase.from("trusted_devices").upsert(
      {
        user_id: userId,
        device_id: deviceId,
        label,
        user_agent: ua,
        last_seen_at: now.toISOString(),
      },
      { onConflict: "user_id,device_id" }
    );
  } catch { /* ignore */ }

  if (!isNewDevice && !dormant) return; // routine login on a trusted device

  try {
    await supabase.functions.invoke("notify", {
      body: {
        type: "security",
        title: isNewDevice ? "New sign-in from a new device" : "Sign-in after a long break",
        body: `${label} \u00b7 ${Intl.DateTimeFormat().resolvedOptions().timeZone || "Unknown location"} \u00b7 ${now.toLocaleString(
          "en-US",
          { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" },
        )}. If this wasn't you, secure your account now.`,
        dedupe_key: `signin-${deviceId}-${now.toISOString().slice(0, 10)}`,
        data: { device: label, deviceId, reason: isNewDevice ? "new_device" : "dormant_device" },
      },
    });
  } catch { /* ignore */ }
}

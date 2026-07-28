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

export async function recordSignIn(userId: string) {
  const ua = navigator.userAgent;
  const label = detectDeviceLabel(ua);
  const deviceId = getDeviceId();

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
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "user_id,device_id" }
    );
  } catch { /* ignore */ }

  // Security alert, exactly like a real bank sends on every sign-in.
  try {
    const when = new Date();
    await supabase.functions.invoke("notify", {
      body: {
        type: "security",
        title: "New sign-in to your account",
        body: `${label} · ${Intl.DateTimeFormat().resolvedOptions().timeZone || "Unknown location"} · ${when.toLocaleString(
          "en-US",
          { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" },
        )}. If this wasn't you, secure your account now.`,
        dedupe_key: `signin-${deviceId}-${when.toISOString().slice(0, 16)}`,
        data: { device: label, deviceId },
      },
    });
  } catch { /* ignore */ }
}

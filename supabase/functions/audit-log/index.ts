// Authenticated client-side audit event sink.
//
// The browser can only assert that *something happened in its session* — it can
// never assert *who* it is. So the actor is always taken from the verified JWT,
// never from the request body, and the event name must be on an allowlist.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

/** Only these client-observable security events may be recorded. */
const ALLOWED = new Set([
  "auth.sign_in",
  "auth.sign_out",
  "auth.mfa_challenge_passed",
  "auth.mfa_enrolled",
  "auth.password_changed",
  "auth.passcode_changed",
  "auth.device_trusted",
  "auth.device_removed",
  "privacy.policy_viewed",
]);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const event = String((body as Record<string, unknown>)?.event ?? "");
    if (!ALLOWED.has(event)) return json({ error: "Unknown event" }, 400);

    const meta = (body as Record<string, unknown>)?.metadata;
    const metadata: Record<string, unknown> =
      meta && typeof meta === "object" && !Array.isArray(meta) ? { ...(meta as object) } : {};
    metadata.userAgent = req.headers.get("user-agent")?.slice(0, 300) ?? null;

    const { error } = await admin.from("audit_logs").insert({
      actor_id: user.id,
      actor_email: user.email ?? null,
      action: event,
      entity_type: "session",
      entity_id: user.id,
      metadata,
    });
    if (error) {
      console.error("audit insert failed", error.message);
      return json({ error: "Could not record event" }, 500);
    }

    return json({ ok: true });
  } catch (e) {
    console.error("audit-log error", (e as Error).message);
    return json({ error: (e as Error).message }, 500);
  }
});

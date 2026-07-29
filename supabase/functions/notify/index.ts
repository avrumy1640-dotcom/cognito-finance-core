// First-party notification writer.
//
// The `notifications` table is service-role-insert only, so the client cannot
// forge notifications for itself or anyone else. This function accepts a small,
// explicitly allow-listed set of client-originated event types, always writes
// them for the *authenticated caller* (the user_id is never taken from the
// request body), and de-duplicates via `dedupe_key`.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { rateLimit, tooManyRequests } from "../_shared/rateLimit.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

// Only these types may be raised by a signed-in client, and always for that
// caller only. Incoming money, KYC decisions and scheduled runs are written
// server-side by the webhook / scheduler instead, never from the browser.
const CLIENT_ALLOWED_TYPES = new Set(["security", "transfer", "card", "alert"]);

// ---------------------------------------------------------------------------
// EMAIL DELIVERY INTEGRATION POINT
// ---------------------------------------------------------------------------
// This is the single place email delivery will be wired in. It is intentionally
// a no-op today: no email provider is configured, so nothing is sent and we do
// NOT pretend otherwise anywhere in the UI. To enable delivery, add a provider
// API key in Project Settings → Secrets and implement the call below.
async function deliverEmail(_args: {
  userId: string;
  type: string;
  title: string;
  body: string | null;
}): Promise<{ delivered: false; reason: string }> {
  return { delivered: false, reason: "No email provider configured" };
}


function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Missing bearer token" }, 401);

    const authed = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await authed.auth.getUser();
    const userId = userRes?.user?.id;
    if (userErr || !userId) return json({ error: "Invalid session" }, 401);

    const rl = rateLimit(`notify:${userId}`, 20);
    if (!rl.allowed) return tooManyRequests(rl.retryAfter, corsHeaders);

    const body = await req.json().catch(() => ({}));
    const type = String(body?.type ?? "");
    const title = String(body?.title ?? "").trim();
    if (!CLIENT_ALLOWED_TYPES.has(type)) return json({ error: `Type not allowed: ${type}` }, 400);
    if (!title || title.length > 200) return json({ error: "title required (max 200 chars)" }, 400);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data, error } = await admin
      .from("notifications")
      .upsert(
        {
          user_id: userId,
          type,
          title,
          body: body?.body ? String(body.body).slice(0, 1000) : null,
          data: typeof body?.data === "object" && body.data ? body.data : {},
          dedupe_key: body?.dedupe_key ? String(body.dedupe_key).slice(0, 200) : null,
        },
        { onConflict: "user_id,dedupe_key", ignoreDuplicates: true },
      )
      .select("id")
      .maybeSingle();

    if (error) return json({ error: error.message }, 500);
    const email = await deliverEmail({
      userId,
      type,
      title,
      body: body?.body ? String(body.body) : null,
    });

    return json({ ok: true, id: data?.id ?? null, email });

  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

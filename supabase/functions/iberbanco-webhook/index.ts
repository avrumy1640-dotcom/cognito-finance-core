// Iberbanco webhook receiver with HMAC signature verification + idempotency.
//
// Security model:
// - Signature: HMAC-SHA256 over the raw request body, using IBERBANCO_WEBHOOK_SECRET.
//   Provider sends the hex digest in the `x-iberbanco-signature` (or `x-signature`) header.
//   Constant-time compared. Missing/invalid → 401.
// - Timestamp freshness: `x-iberbanco-timestamp` (unix seconds) must be within ±5 min → replay guard.
// - Idempotency: DB unique index on (provider, event_id). Duplicate event_id → 200 no-op.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const PROVIDER = "iberbanco";
const MAX_SKEW_SECONDS = 300;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function hexToBytes(hex: string): Uint8Array | null {
  const clean = hex.trim().toLowerCase().replace(/^sha256=/, "");
  if (!/^[0-9a-f]+$/.test(clean) || clean.length % 2 !== 0) return null;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function hmacSha256(secret: string, body: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return new Uint8Array(sig);
}

export async function verifySignature(
  rawBody: string,
  signatureHeader: string | null,
  timestampHeader: string | null,
  secret: string,
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  if (!signatureHeader) return { ok: false, status: 401, message: "missing signature" };
  if (!timestampHeader) return { ok: false, status: 401, message: "missing timestamp" };
  const ts = Number(timestampHeader);
  if (!Number.isFinite(ts)) return { ok: false, status: 401, message: "invalid timestamp" };
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > MAX_SKEW_SECONDS) {
    return { ok: false, status: 401, message: "stale timestamp (replay guard)" };
  }
  const provided = hexToBytes(signatureHeader);
  if (!provided) return { ok: false, status: 401, message: "malformed signature" };
  const signed = `${timestampHeader}.${rawBody}`;
  const expected = await hmacSha256(secret, signed);
  if (!timingSafeEqual(provided, expected)) {
    return { ok: false, status: 401, message: "invalid signature" };
  }
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const secret = Deno.env.get("IBERBANCO_WEBHOOK_SECRET");
  if (!secret) {
    console.error("IBERBANCO_WEBHOOK_SECRET not configured");
    return json({ error: "webhook receiver not configured" }, 503);
  }

  const rawBody = await req.text();
  const sigHeader = req.headers.get("x-iberbanco-signature") ?? req.headers.get("x-signature");
  const tsHeader = req.headers.get("x-iberbanco-timestamp") ?? req.headers.get("x-timestamp");

  const verified = await verifySignature(rawBody, sigHeader, tsHeader, secret);
  if (!verified.ok) {
    console.warn("webhook rejected:", verified.message);
    return json({ error: verified.message }, verified.status);
  }

  let payload: Record<string, unknown> = {};
  try { payload = rawBody ? JSON.parse(rawBody) : {}; } catch {
    return json({ error: "invalid json" }, 400);
  }

  const eventId = String(payload.event_id ?? payload.id ?? "").trim();
  const eventType = String(payload.event_type ?? payload.type ?? "unknown");
  if (!eventId) return json({ error: "missing event_id in payload" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Idempotency: unique (provider, event_id) — duplicates return 200 without reprocessing.
  const { data: existing } = await supabase
    .from("webhook_events")
    .select("id, status")
    .eq("provider", PROVIDER)
    .eq("event_id", eventId)
    .maybeSingle();

  if (existing) {
    return json({ ok: true, duplicate: true, id: existing.id, status: existing.status });
  }

  const { data: inserted, error: insertError } = await supabase
    .from("webhook_events")
    .insert({
      provider: PROVIDER,
      event_id: eventId,
      event_type: eventType,
      status: "received",
      signature: sigHeader,
      payload,
      attempts: 1,
    })
    .select("id")
    .single();

  if (insertError) {
    // Unique violation → concurrent duplicate, treat as success.
    if ((insertError as { code?: string }).code === "23505") {
      return json({ ok: true, duplicate: true });
    }
    console.error("webhook insert failed", insertError);
    return json({ error: "storage failed" }, 500);
  }

  await supabase
    .from("webhook_events")
    .update({ status: "processed", processed_at: new Date().toISOString() })
    .eq("id", inserted!.id);

  return json({ ok: true, id: inserted!.id });
});

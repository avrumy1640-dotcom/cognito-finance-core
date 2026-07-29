// Column webhook receiver.
//
// Every request must carry a valid `Column-Signature` header: the hex
// HMAC-SHA256 of the RAW request body, keyed with COLUMN_WEBHOOK_SECRET.
// Anything else is rejected with 401 before a single byte is processed.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("COLUMN_WEBHOOK_SECRET") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const toHex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");

async function hmacHex(secret: string, raw: string) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)));
}

/** Constant-time comparison — never leak signature bytes through timing. */
function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const cents = (n: unknown) => (typeof n === "number" ? n : 0);

/**
 * Column does NOT guarantee event ordering: `submitted` can land after
 * `completed`. Rank the lifecycle so a late-arriving earlier stage can never
 * walk a transfer backwards. Unknown statuses rank 1 (in-flight) so genuinely
 * new states still apply; terminal states are never overwritten by anything
 * except another terminal state that arrived later.
 */
const STATUS_RANK: Record<string, number> = {
  initiated: 0, scheduled: 0, pending: 1, submitted: 2, manual_review: 2,
  completed: 3, settled: 3, posted: 3,
  returned: 4, canceled: 4, cancelled: 4, rejected: 4, failed: 4,
};
const rankOf = (s: string) => STATUS_RANK[s] ?? 1;

/** True when the incoming event should be allowed to overwrite what we hold. */
function shouldApply(prev: { status?: string; occurred_at?: string } | null, nextStatus: string, occurredAt?: string) {
  if (!prev?.status) return true;
  const prevRank = rankOf(String(prev.status).toLowerCase());
  const nextRank = rankOf(nextStatus);
  if (nextRank > prevRank) return true;
  if (nextRank < prevRank) return false;
  // Same stage — prefer the newer event timestamp when we have one.
  if (!occurredAt || !prev.occurred_at) return true;
  return Date.parse(occurredAt) >= Date.parse(prev.occurred_at);
}

async function userForBankAccount(bankAccountId?: string) {
  if (!bankAccountId) return null;
  const { data } = await admin.from("column_bank_accounts")
    .select("user_id").eq("bank_account_id", bankAccountId).maybeSingle();
  return data?.user_id ?? null;
}

async function notify(userId: string | null, args: { type: string; title: string; body?: string; dedupe_key: string }) {
  if (!userId) return;
  try {
    await admin.from("notifications").insert({ user_id: userId, ...args });
  } catch { /* notification delivery must never fail a webhook */ }
}


async function handleEvent(type: string, data: any) {
  // --- entity / identity verification ------------------------------------
  if (type.startsWith("entity.")) {
    const entityId = data?.id ?? data?.entity_id;
    if (!entityId) return "ignored: no entity id";
    const status = data?.verification_status ?? (type.endsWith("verified") ? "verified" : "pending");
    // Out-of-order safety: a late "pending" must not undo a decided verdict.
    const { data: current } = await admin.from("column_entities")
      .select("verification_status").eq("entity_id", entityId).maybeSingle();
    const decided = ["verified", "denied", "rejected"];
    if (current && decided.includes(String(current.verification_status ?? "").toLowerCase())
        && !decided.includes(String(status).toLowerCase())) {
      return `entity ${entityId}: ignored out-of-order "${status}" (have "${current.verification_status}")`;
    }
    const { data: row } = await admin.from("column_entities")
      .update({ verification_status: status, details: data })
      .eq("entity_id", entityId).select("user_id").maybeSingle();

    if (row?.user_id) {
      // Mirror the partner's verdict onto our own KYC gate so access changes
      // in real time, without the user re-submitting anything.
      const v = String(status).toLowerCase();
      const mapped = v === "verified" ? "verified"
        : v === "denied" || v === "rejected" ? "rejected"
        : v === "pending" || v === "manual_review" ? "pending" : null;
      if (mapped) {
        await admin.from("kyc_profiles")
          .update({ status: mapped, reviewed_at: new Date().toISOString() })
          .eq("user_id", row.user_id);
      }
      await notify(row.user_id, {
        type: "alert",
        title: status === "verified" ? "Identity verified" : `Identity check: ${status}`,
        body: "Your banking profile was updated by our banking partner.",
        dedupe_key: `column-entity-${entityId}-${status}`,
      });
    }

    return `entity ${entityId} → ${status}`;
  }

  // --- ACH / book / wire transfer status ---------------------------------
  if (type.startsWith("ach.") || type.startsWith("book.") || type.startsWith("wire.")) {
    const kind = type.split(".")[0];
    const t = data ?? {};
    const transferId = t.id ?? t.transfer_id;
    if (!transferId) return "ignored: no transfer id";
    const accId = t.bank_account_id ?? t.sender_bank_account_id ?? t.receiver_bank_account_id;
    const userId = await userForBankAccount(accId)
      ?? await userForBankAccount(t.receiver_bank_account_id)
      ?? await userForBankAccount(t.sender_bank_account_id);
    // ACH DEBIT pulls money IN; ACH CREDIT pushes it out. Book/wire transfers
    // are credits when we are the receiving side.
    const isCredit = kind === "ach"
      ? t.type === "DEBIT"
      : !!(t.receiver_bank_account_id && (await userForBankAccount(t.receiver_bank_account_id)));

    const status = String(t.status ?? type.split(".").pop() ?? "pending").toLowerCase();
    const occurredAt = t.created_at ?? new Date().toISOString();

    // Out-of-order safety: never regress a transfer we already know is further
    // along. Re-delivery of the same event is a no-op, not a state change.
    const { data: prev } = await admin.from("column_transfers")
      .select("status, occurred_at").eq("transfer_id", transferId).maybeSingle();
    if (!shouldApply(prev as any, status, occurredAt)) {
      return `${kind} transfer ${transferId}: ignored out-of-order "${status}" (have "${prev?.status}")`;
    }

    await admin.from("column_transfers").upsert({
      user_id: userId,
      transfer_id: transferId,
      transfer_type: kind,
      bank_account_id: accId ?? null,
      status,
      amount_cents: cents(t.amount),
      currency: t.currency_code ?? "USD",
      direction: isCredit ? "credit" : "debit",
      description: t.description ?? `${kind.toUpperCase()} transfer`,
      raw: t,
      occurred_at: occurredAt,
    }, { onConflict: "transfer_id" });

    if (["returned", "rejected", "failed", "canceled", "cancelled"].includes(status)) {
      await notify(userId, {
        type: "alert",
        title: `Transfer ${status}: $${(cents(t.amount) / 100).toFixed(2)}`,
        body: t.return_reason ?? t.reason ?? `${kind.toUpperCase()} transfer was ${status}.`,
        dedupe_key: `column-transfer-${transferId}-${status}`,
      });
    } else if (["completed", "settled", "posted"].includes(status)) {
      await notify(userId, {
        type: "transfer",
        title: `${isCredit ? "Money in" : "Money out"}: $${(cents(t.amount) / 100).toFixed(2)}`,
        body: t.description ?? `${kind.toUpperCase()} transfer ${status}`,
        dedupe_key: `column-transfer-${transferId}-${status}`,
      });
    }

    return `${kind} transfer ${transferId} → ${status}`;
  }

  // --- account events, incl. overdraft ------------------------------------
  if (type.startsWith("bank_account.") || type.startsWith("account.")) {
    const accId = data?.id ?? data?.bank_account_id;
    if (!accId) return "ignored: no account id";
    const overdrawn = type.includes("overdraft") || data?.is_overdrawn === true;
    const { data: row } = await admin.from("column_bank_accounts").update({
      balances: data?.balances ?? {},
      is_overdrawn: overdrawn,
      status: data?.is_closed ? "closed" : "open",
    }).eq("bank_account_id", accId).select("user_id").maybeSingle();
    if (overdrawn && row?.user_id) {
      await notify(row.user_id, {
        type: "alert",
        title: "Your account is overdrawn",
        body: "Add funds to bring your balance back above zero.",
        dedupe_key: `column-overdraft-${accId}-${new Date().toISOString().slice(0, 10)}`,
      });
    }
    return `account ${accId} updated${overdrawn ? " (overdrawn)" : ""}`;
  }

  return `unhandled event type ${type}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const raw = await req.text();
  const provided = (req.headers.get("Column-Signature") ?? "").trim().replace(/^sha256=/, "");

  if (!WEBHOOK_SECRET) {
    console.error("COLUMN_WEBHOOK_SECRET is not configured — rejecting webhook");
    return json({ error: "Webhook not configured" }, 503);
  }
  const expected = await hmacHex(WEBHOOK_SECRET, raw);
  if (!provided || !timingSafeEqual(provided.toLowerCase(), expected)) {
    await admin.from("webhook_events").insert({
      provider: "column", event_type: "signature.invalid", status: "rejected",
      payload: { bodyLength: raw.length }, signature: provided.slice(0, 16),
      error: "Invalid Column-Signature",
    });
    return json({ error: "Invalid signature" }, 401);
  }

  let event: any;
  try { event = JSON.parse(raw); } catch { return json({ error: "Invalid JSON" }, 400); }

  const eventId: string | null = event?.id ?? event?.event_id ?? null;
  const eventType: string = event?.type ?? event?.event_type ?? "unknown";
  const data = event?.data ?? event?.object ?? event;

  // Idempotency — same event id is acknowledged but never re-processed.
  if (eventId) {
    const { data: seen } = await admin.from("webhook_events")
      .select("id").eq("provider", "column").eq("event_id", eventId).maybeSingle();
    if (seen) return json({ ok: true, deduped: true });
  }

  const { data: logRow } = await admin.from("webhook_events").insert({
    provider: "column", event_id: eventId, event_type: eventType,
    status: "received", payload: event, signature: provided.slice(0, 16),
  }).select("id").maybeSingle();

  try {
    const result = await handleEvent(eventType, data);
    if (logRow?.id) {
      await admin.from("webhook_events").update({
        status: "processed", processed_at: new Date().toISOString(), error: null,
      }).eq("id", logRow.id);
    }
    return json({ ok: true, result });
  } catch (e) {
    const msg = (e as Error).message;
    console.error("column-webhook processing error", msg);
    if (logRow?.id) {
      await admin.from("webhook_events").update({ status: "failed", error: msg }).eq("id", logRow.id);
    }
    return json({ ok: false, error: msg }, 500);
  }
});

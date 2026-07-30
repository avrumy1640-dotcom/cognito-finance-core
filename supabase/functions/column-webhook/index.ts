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
  initiated: 0, scheduled: 0, pending: 1, pending_submission: 1,
  manual_review: 2, submitted: 2,
  completed: 3, settled: 3, posted: 3,
  returned: 4, dishonored: 4, contested: 4, canceled: 4, cancelled: 4,
  rejected: 4, failed: 4,
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
  // `identity.verification.*` carries the same verdict shape as `entity.*`.
  if (type.startsWith("entity.") || type.startsWith("identity.")) {
    const entityId = data?.id ?? data?.entity_id;
    if (!entityId) return "ignored: no entity id";
    const tail = type.split(".").pop() ?? "";
    // Column sends `verification_status` UPPERCASE (VERIFIED / PENDING /
    // MANUAL_REVIEW / DENIED / UNVERIFIED). Lowercase it immediately: every
    // comparison below (and everything we persist) is lowercase, so a raw
    // uppercase value would silently match nothing.
    const status = String(
      data?.verification_status
        ?? (tail === "verified" || tail === "approved" ? "verified"
          : tail === "denied" || tail === "rejected" ? "denied"
          : tail === "manual_review" ? "manual_review" : "pending"),
    ).trim().toLowerCase();

    // Out-of-order safety: a late "pending" must not undo a decided verdict.
    const { data: current } = await admin.from("column_entities")
      .select("verification_status").eq("entity_id", entityId).maybeSingle();
    const decided = ["verified", "denied", "rejected"];
    if (current && decided.includes(String(current.verification_status ?? "").toLowerCase())
        && !decided.includes(status)) {
      return `entity ${entityId}: ignored out-of-order "${status}" (have "${current.verification_status}")`;
    }
    const { data: row } = await admin.from("column_entities")
      .update({ verification_status: status, details: data })
      .eq("entity_id", entityId).select("user_id").maybeSingle();

    if (row?.user_id) {
      // Mirror the partner's verdict onto our own KYC gate so access changes
      // in real time, without the user re-submitting anything.
      const mapped = status === "verified" ? "verified"
        : status === "denied" || status === "rejected" ? "rejected"
        : status === "pending" || status === "manual_review" ? "pending" : null;
      if (mapped) {
        await admin.from("kyc_profiles")
          .update({ status: mapped, reviewed_at: new Date().toISOString() })
          .eq("user_id", row.user_id);
      }
      await notify(row.user_id, {
        type: "alert",
        title: status === "verified" ? "Identity verified" : `Identity check: ${status.replace(/_/g, " ")}`,
        body: "Your banking profile was updated by our banking partner.",
        dedupe_key: `column-entity-${entityId}-${status}`,
      });
    }


    return `entity ${entityId} → ${status}`;
  }

  // --- ACH notification of change (NOC) -----------------------------------
  // Not a status change: the RDFI is telling us the counterparty's routing or
  // account number changed. We log it and tell the user, but never silently
  // rewrite stored bank details.
  if (type.endsWith(".noc") || type.includes("notification_of_change")) {
    const t = data ?? {};
    const transferId = t.id ?? t.transfer_id ?? "unknown";
    const accId = t.bank_account_id ?? t.sender_bank_account_id;
    const userId = await userForBankAccount(accId);
    await notify(userId, {
      type: "alert",
      title: "Recipient bank details changed",
      body: t.change_code
        ? `The receiving bank returned a notification of change (${t.change_code}). Update the saved recipient before your next transfer.`
        : "The receiving bank asked us to update the saved account details for this recipient.",
      dedupe_key: `column-noc-${transferId}`,
    });
    console.log("ACH notification of change", JSON.stringify({ transferId, data: t }));
    return `noc logged for transfer ${transferId}`;
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

    // Internal book transfers are mirrored as two legs (":out" / ":in"), so a
    // status update has to land on whichever rows we already hold.
    const legIds = [transferId, `${transferId}:out`, `${transferId}:in`];
    const { data: existing } = await admin.from("column_transfers")
      .select("transfer_id, status, occurred_at").in("transfer_id", legIds);
    const rows = existing ?? [];

    if (rows.length) {
      const applied: string[] = [];
      for (const row of rows) {
        if (!shouldApply(row as any, status, occurredAt)) continue;
        await admin.from("column_transfers")
          .update({ status, raw: t, occurred_at: occurredAt })
          .eq("transfer_id", row.transfer_id);
        applied.push(row.transfer_id);
      }
      if (!applied.length) {
        return `${kind} transfer ${transferId}: ignored out-of-order "${status}"`;
      }
    } else {
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
    }

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

  // --- statements & reports ----------------------------------------------
  // Column generates a real monthly statement (PDF + CSV) per open account and
  // announces it as a completed settlement report. Mirror the pointer so the
  // customer's Documents screen shows the bank's own statement, not ours.
  if (type.startsWith("reporting.")) {
    const r = data ?? {};
    const accId = r.statement_subject_id ?? r.bank_account_id;
    if (!r.id || !accId) return "ignored: report without a subject account";
    if (!type.includes("monthly_statement")) return `reporting event ${type} ignored`;

    await admin.from("account_statements").upsert({
      bank_account_id: String(accId),
      report_id: String(r.id),
      statement_type: String(r.type ?? "bank_account_monthly_statement"),
      period_start: r.from_date ?? null,
      period_end: r.to_date ?? null,
      pdf_document_id: r.pdf_document_id || null,
      csv_document_id: r.csv_document_id || null,
      status: String(r.status ?? "completed").toLowerCase(),
      raw: r,
    }, { onConflict: "report_id" });

    const userId = await userForBankAccount(String(accId));
    await notify(userId, {
      type: "alert",
      title: "Your monthly statement is ready",
      body: r.to_date ? `Statement period ending ${r.to_date} is available in Documents.` : "A new statement is available in Documents.",
      dedupe_key: `column-statement-${r.id}`,
    });
    return `statement ${r.id} recorded for ${accId}`;
  }

  // --- account events, incl. overdraft and freeze -------------------------
  if (type.startsWith("bank_account.") || type.startsWith("account.")) {
    const accId = data?.id ?? data?.bank_account_id;
    if (!accId) return "ignored: no account id";
    const overdrawn = type.includes("overdraft") || data?.is_overdrawn === true;
    const frozen = type.includes("frozen") || data?.is_frozen === true;
    // Column's account object reports a `status` string; `is_closed` is not a
    // real field, so trust `status` first and only then the event name.
    const raw = String(data?.status ?? "").trim().toLowerCase();
    const status = raw || (data?.is_closed || type.includes("closed") ? "closed" : frozen ? "frozen" : "open");
    const { data: row } = await admin.from("column_bank_accounts").update({
      balances: data?.balances ?? {},
      is_overdrawn: overdrawn,
      status,
    }).eq("bank_account_id", accId).select("user_id").maybeSingle();

    if (overdrawn && row?.user_id) {
      await notify(row.user_id, {
        type: "alert",
        title: "Your account is overdrawn",
        body: "Add funds to bring your balance back above zero.",
        dedupe_key: `column-overdraft-${accId}-${new Date().toISOString().slice(0, 10)}`,
      });
    }
    if (frozen && row?.user_id) {
      await notify(row.user_id, {
        type: "alert",
        title: "Your account has been frozen",
        body: "Money movement is paused while our banking partner reviews the account. Contact support for help.",
        dedupe_key: `column-frozen-${accId}`,
      });
    }
    return `account ${accId} → ${status}${overdrawn ? " (overdrawn)" : ""}`;
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

  // Idempotency. Column can deliver the same event id more than once, possibly
  // concurrently, so the claim is the INSERT itself: a unique index on
  // (provider, event_id) means exactly one delivery wins and the losers exit
  // with a 200 before touching any ledger state.
  const { data: logRow, error: claimError } = await admin.from("webhook_events").insert({
    provider: "column", event_id: eventId, event_type: eventType,
    status: "received", payload: event, signature: provided.slice(0, 16),
  }).select("id").maybeSingle();

  if (claimError) {
    // 23505 = unique violation → this event was already claimed/processed.
    if ((claimError as { code?: string }).code === "23505") {
      return json({ ok: true, deduped: true });
    }
    console.error("webhook_events insert failed", claimError.message);
  }


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

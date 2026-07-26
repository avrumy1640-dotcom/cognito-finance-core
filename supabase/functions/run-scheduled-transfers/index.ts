// Scheduled transfer executor.
//
// Invoked by pg_cron every 15 minutes. For each schedule that is due it:
//   1. Claims a per-occurrence row in `scheduled_transfer_runs` — the UNIQUE
//      (schedule_id, occurrence_key) constraint is what makes double-sending
//      impossible even if cron overlaps or the function is retried.
//   2. Re-applies the SAME ownership checks the interactive iberbanco-proxy
//      applies: the Iberbanco user_number is resolved from the schedule owner's
//      kyc_profiles row (never from the schedule payload), and the source
//      account must belong to that user_number. The schedule row can therefore
//      never be used to move another customer's money.
//   3. Calls the same Iberbanco endpoints the manual transfer path calls.
//   4. Records the transaction reference, advances next_run_at for recurring
//      schedules, and marks the schedule as needing attention after
//      MAX_CONSECUTIVE_FAILURES.
//   5. Writes a real notification for each success/failure.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BASE = Deno.env.get("IBERBANCO_BASE_URL") || "";

const MAX_CONSECUTIVE_FAILURES = 3;

// ---------------------------------------------------------------- Iberbanco
let cachedToken: string | null = null;
let cachedUsername: string | null = null;
let cachedExpiry = 0;

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function authenticate(): Promise<{ token: string; username: string }> {
  if (!BASE) throw new Error("IBERBANCO_BASE_URL not configured");
  const username = Deno.env.get("IBERBANCO_AGENT_USERNAME") || "";
  const password = Deno.env.get("IBERBANCO_AGENT_PASSWORD") || "";
  if (!username || !password) throw new Error("Iberbanco agent credentials not configured");
  const now = Date.now();
  if (cachedToken && cachedUsername === username && now < cachedExpiry - 60_000) {
    return { token: cachedToken, username: cachedUsername };
  }
  const res = await fetch(`${BASE}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const text = await res.text();
  let jsonBody: Record<string, any> | null = null;
  try { jsonBody = text ? JSON.parse(text) : null; } catch { /* noop */ }
  if (!res.ok || !jsonBody?.data?.token) {
    throw new Error(`Iberbanco auth failed (${res.status})`);
  }
  cachedToken = String(jsonBody.data.token);
  cachedUsername = username;
  const exp = jsonBody.data.token_expire_at ? Date.parse(jsonBody.data.token_expire_at) : now + 30 * 60_000;
  cachedExpiry = Number.isFinite(exp) ? exp : now + 30 * 60_000;
  return { token: cachedToken, username: cachedUsername };
}

async function iberbanco(
  path: string,
  init: { method?: string; body?: unknown; query?: Record<string, unknown> } = {},
): Promise<{ status: number; payload: any }> {
  const { token, username } = await authenticate();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const hash = await sha256Hex(token + timestamp + username);
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(init.query ?? {})) {
    if (v === undefined || v === null || v === "") continue;
    url.searchParams.set(k, String(v));
  }
  const headers: Record<string, string> = { token, timestamp, hash, Accept: "application/json" };
  let body: string | undefined;
  if (init.body !== undefined && init.method && init.method !== "GET") {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.body);
  }
  const res = await fetch(url.toString(), { method: init.method || "GET", headers, body });
  const text = await res.text();
  let payload: unknown;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = { raw: text }; }
  return { status: res.status, payload };
}

// ------------------------------------------------------------- helpers
type Freq = "once" | "weekly" | "biweekly" | "monthly";

function advance(from: Date, freq: Freq): Date | null {
  const n = new Date(from);
  if (freq === "weekly") n.setDate(n.getDate() + 7);
  else if (freq === "biweekly") n.setDate(n.getDate() + 14);
  else if (freq === "monthly") n.setMonth(n.getMonth() + 1);
  else return null;
  return n;
}

/** Stable per-occurrence identity — the idempotency key. */
function occurrenceKey(scheduleId: string, dueIso: string): string {
  return `${scheduleId}:${new Date(dueIso).toISOString()}`;
}

function extractRef(payload: any): string | null {
  const d = payload?.data ?? payload;
  return (
    d?.transaction_number ?? d?.transaction?.transaction_number ?? d?.reference ?? d?.id ?? null
  );
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ------------------------------------------------------------- main
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(supabaseUrl, serviceKey);
  const nowIso = new Date().toISOString();
  const results: Array<Record<string, unknown>> = [];

  try {
    const { data: due, error } = await admin
      .from("scheduled_transfers")
      .select("*")
      .eq("status", "scheduled")
      .eq("needs_attention", false)
      .or(`next_run_at.lte.${nowIso},and(next_run_at.is.null,scheduled_for.lte.${nowIso})`)
      .limit(50);

    if (error) return json({ error: error.message }, 500);

    for (const row of due ?? []) {
      const dueAt: string = row.next_run_at ?? row.scheduled_for;
      const key = occurrenceKey(row.id, dueAt);

      // ---- 1. Idempotent claim ------------------------------------------
      const { error: claimErr } = await admin.from("scheduled_transfer_runs").insert({
        schedule_id: row.id,
        user_id: row.user_id,
        occurrence_key: key,
        status: "running",
      });
      if (claimErr) {
        // Unique violation => this occurrence already ran (or is running).
        results.push({ id: row.id, skipped: "already_claimed" });
        continue;
      }

      let ok = false;
      let ref: string | null = null;
      let failure: string | null = null;

      try {
        // ---- 2. Ownership resolution (identical rules to iberbanco-proxy) --
        const { data: kyc } = await admin
          .from("kyc_profiles")
          .select("iberbanco_user_number")
          .eq("user_id", row.user_id)
          .maybeSingle();
        const userNumber = kyc?.iberbanco_user_number as string | undefined;
        if (!userNumber) throw new Error("Iberbanco profile not provisioned for this user");

        const accRes = await iberbanco("/accounts", {
          method: "GET",
          query: { user_number: userNumber, per_page: 100 },
        });
        if (accRes.status < 200 || accRes.status >= 300) {
          throw new Error(`Could not list accounts (${accRes.status})`);
        }
        const list: any[] = Array.isArray(accRes.payload?.data) ? accRes.payload.data : [];
        const owned = new Set(list.map((a) => String(a.account_special_number)));

        const meta = (row.metadata ?? {}) as Record<string, string>;
        const fromAccount = String(meta.from_account_number ?? row.from_account);
        if (!owned.has(fromAccount)) {
          throw new Error("Source account does not belong to the schedule owner");
        }

        const amount = Math.round(Number(row.amount));
        const reference = String(row.memo || row.to_label || "Scheduled transfer").slice(0, 60);

        // ---- 3. Execute via the same Iberbanco endpoints as a manual send --
        let res: { status: number; payload: any };
        if (row.kind === "internal") {
          const toAccount = String(meta.to_account_number ?? row.to_label);
          if (!owned.has(toAccount)) throw new Error("Destination account does not belong to the schedule owner");
          res = await iberbanco("/transactions/internal", {
            method: "POST",
            body: {
              user_number: userNumber,
              account_number_from: fromAccount,
              account_number_to: toAccount,
              amount,
              reference,
            },
          });
        } else if (row.kind === "external") {
          const routing = String(meta.routingNumber ?? "");
          res = await iberbanco("/transactions/ach", {
            method: "POST",
            body: {
              user_number: userNumber,
              account_number: fromAccount,
              amount,
              reference,
              beneficiary_name: meta.bank ?? row.to_label,
              beneficiary_address: "N/A",
              beneficiary_email: meta.beneficiary_email ?? "noreply@example.com",
              bank_name: meta.bank ?? row.to_label,
              bank_country: "United States",
              bank_address: "N/A",
              beneficiary_account_number: meta.accountNumber ?? "",
              institution_number: routing.slice(0, 3),
              transit_number: routing.slice(-5),
            },
          });
        } else if (row.kind === "wire") {
          res = await iberbanco("/transactions/swift", {
            method: "POST",
            body: {
              user_number: userNumber,
              account_number: fromAccount,
              amount,
              reference,
              iban_code: meta.accountNumber ?? "",
              beneficiary_name: row.to_label,
              beneficiary_country: "United States",
              beneficiary_state: "N/A",
              beneficiary_city: "N/A",
              beneficiary_address: "N/A",
              beneficiary_zip_code: "00000",
              swift_code: meta.routingNumber ?? "",
              bank_name: meta.bank ?? "Beneficiary Bank",
              bank_country: "United States",
              bank_state: "N/A",
              bank_city: "N/A",
              bank_address: "N/A",
              bank_zip_code: "00000",
            },
          });
        } else if (row.kind === "bill") {
          res = await iberbanco("/transactions/bill", {
            method: "POST",
            body: {
              user_number: userNumber,
              account_number: fromAccount,
              amount,
              reference,
              payee_name: row.to_label,
              payee_code: (meta.routingNumber || "BILL").slice(0, 20),
              payee_account_number: meta.accountNumber ?? "",
              beneficiary_email: meta.beneficiary_email ?? "noreply@example.com",
            },
          });
        } else {
          throw new Error(`Transfer type "${row.kind}" is not supported by the banking partner`);
        }

        if (res.status < 200 || res.status >= 300) {
          throw new Error(res.payload?.message ?? `Iberbanco rejected the transfer (${res.status})`);
        }
        ref = extractRef(res.payload);
        ok = true;
      } catch (err) {
        failure = err instanceof Error ? err.message : String(err);
      }

      // ---- 4. Record the outcome ----------------------------------------
      await admin
        .from("scheduled_transfer_runs")
        .update({
          status: ok ? "succeeded" : "failed",
          transaction_ref: ref,
          error: failure,
          finished_at: new Date().toISOString(),
        })
        .eq("schedule_id", row.id)
        .eq("occurrence_key", key);

      const failures = ok ? 0 : (row.consecutive_failures ?? 0) + 1;
      const nextRun = ok ? advance(new Date(dueAt), row.frequency as Freq) : null;
      const exhausted = !ok && failures >= MAX_CONSECUTIVE_FAILURES;

      await admin
        .from("scheduled_transfers")
        .update({
          status: ok
            ? row.frequency === "once" ? "completed" : "scheduled"
            : exhausted ? "failed" : "scheduled",
          last_run_at: new Date().toISOString(),
          last_error: failure,
          last_transaction_ref: ref ?? row.last_transaction_ref,
          consecutive_failures: failures,
          needs_attention: exhausted,
          next_run_at: ok ? (nextRun ? nextRun.toISOString() : null) : row.next_run_at ?? row.scheduled_for,
        })
        .eq("id", row.id);

      // ---- 5. Notify the owner ------------------------------------------
      await admin.from("notifications").upsert(
        {
          user_id: row.user_id,
          type: ok ? "transfer" : "alert",
          title: ok ? "Scheduled transfer sent" : "Scheduled transfer failed",
          body: ok
            ? `${row.currency} ${Number(row.amount).toFixed(2)} to ${row.to_label}${ref ? ` · ref ${ref}` : ""}`
            : `${row.currency} ${Number(row.amount).toFixed(2)} to ${row.to_label} — ${failure}${exhausted ? " (schedule paused, needs your attention)" : ""}`,
          data: { schedule_id: row.id, occurrence_key: key, transaction_ref: ref },
          dedupe_key: `sched:${key}`,
        },
        { onConflict: "user_id,dedupe_key", ignoreDuplicates: true },
      );

      results.push({ id: row.id, ok, ref, error: failure, needs_attention: exhausted });
    }

    return json({ processed: results.length, results });
  } catch (err) {
    console.error("run-scheduled-transfers error", err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

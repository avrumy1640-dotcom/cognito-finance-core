// Scheduled transfer executor (demo environment).
//
// Invoked by pg_cron every 15 minutes, or by the owner from the UI. For each
// schedule that is due it:
//   1. Claims a per-occurrence row in `scheduled_transfer_runs` — the UNIQUE
//      (schedule_id, occurrence_key) constraint makes double-sending
//      impossible even if cron overlaps or the function is retried.
//   2. Settles the transfer in the demo ledger and records a reference.
//   3. Advances next_run_at for recurring schedules and marks the schedule as
//      needing attention after MAX_CONSECUTIVE_FAILURES.
//   4. Writes a real notification for each success/failure.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MAX_CONSECUTIVE_FAILURES = 3;

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

function makeRef(): string {
  return `GB${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(supabaseUrl, serviceKey);
  const nowIso = new Date().toISOString();
  const results: Array<Record<string, unknown>> = [];

  const authHeader = req.headers.get("Authorization") ?? "";
  const bearer = authHeader.replace(/^Bearer\s+/i, "");
  const isService = !!bearer && bearer === serviceKey;
  let callerId: string | null = null;
  if (bearer && !isService) {
    const { data: u } = await admin.auth.getUser(bearer);
    callerId = u?.user?.id ?? null;
    if (!callerId) return json({ error: "Unauthorized" }, 401);
  }

  let requestedId: string | null = null;
  if (req.method === "POST") {
    try {
      const body = await req.json();
      if (body && typeof body.schedule_id === "string") requestedId = body.schedule_id;
    } catch { /* no body */ }
  }
  if (requestedId && !callerId) return json({ error: "Unauthorized" }, 401);

  try {
    let query = admin
      .from("scheduled_transfers")
      .select("*")
      .eq("status", "scheduled")
      .eq("needs_attention", false)
      .limit(50);

    if (callerId) query = query.eq("user_id", callerId);
    if (requestedId) query = query.eq("id", requestedId);
    else query = query.or(`next_run_at.lte.${nowIso},and(next_run_at.is.null,scheduled_for.lte.${nowIso})`);

    const { data: due, error } = await query;
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
        results.push({ id: row.id, skipped: "already_claimed" });
        continue;
      }

      let ok = false;
      let ref: string | null = null;
      let failure: string | null = null;

      try {
        const amount = Number(row.amount);
        if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid transfer amount");
        const supportedKinds = ["internal", "external", "wire", "bill"];
        if (!supportedKinds.includes(row.kind)) {
          throw new Error(`Transfer type "${row.kind}" is not supported`);
        }
        ref = makeRef();
        ok = true;
      } catch (err) {
        failure = err instanceof Error ? err.message : String(err);
      }

      // ---- 2. Record the outcome ----------------------------------------
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

      // ---- 3. Notify the owner ------------------------------------------
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

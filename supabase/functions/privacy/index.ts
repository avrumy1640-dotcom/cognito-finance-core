// Privacy & data-rights endpoint.
//
// Two actions, both strictly scoped to the authenticated caller:
//   export         -> machine-readable copy of everything we hold (GDPR Art. 15/20, CCPA)
//   delete_account -> erase what is legally erasable, retain what BSA/AML requires
//
// Financial records (transfers, accounts, KYC/CIP identity records) are subject
// to a 5-year retention obligation under the Bank Secrecy Act (31 CFR 1010.430)
// and cannot be deleted on request. We say that plainly instead of pretending.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/** Every table that can hold data about a person, and the column that owns it. */
const OWNED: Array<{ table: string; column: string }> = [
  { table: "profiles", column: "user_id" },
  { table: "kyc_profiles", column: "user_id" },
  { table: "business_profiles", column: "user_id" },
  { table: "beneficiaries", column: "user_id" },
  { table: "notifications", column: "user_id" },
  { table: "notification_preferences", column: "user_id" },
  { table: "login_history", column: "user_id" },
  { table: "trusted_devices", column: "user_id" },
  { table: "webauthn_credentials", column: "user_id" },
  { table: "user_security_settings", column: "user_id" },
  { table: "user_roles", column: "user_id" },
  { table: "transaction_categories", column: "user_id" },
  { table: "transaction_receipts", column: "user_id" },
  { table: "scheduled_transfers", column: "user_id" },
  { table: "scheduled_transfer_runs", column: "user_id" },
  { table: "support_tickets", column: "user_id" },
  { table: "support_messages", column: "user_id" },
  { table: "payment_requests", column: "requester_id" },
  { table: "invoices", column: "user_id" },
  { table: "bills", column: "user_id" },
  { table: "reimbursements", column: "requester_user_id" },
  { table: "column_entities", column: "user_id" },
  { table: "column_bank_accounts", column: "user_id" },
  { table: "column_counterparties", column: "user_id" },
  { table: "column_transfers", column: "user_id" },
  { table: "account_owners", column: "user_id" },
  { table: "audit_logs", column: "actor_id" },
];

/** Rows that exist purely for convenience/preference and carry no ledger value. */
const ERASABLE: Array<{ table: string; column: string }> = [
  { table: "beneficiaries", column: "user_id" },
  { table: "notifications", column: "user_id" },
  { table: "notification_preferences", column: "user_id" },
  { table: "trusted_devices", column: "user_id" },
  { table: "webauthn_credentials", column: "user_id" },
  { table: "user_security_settings", column: "user_id" },
  { table: "transaction_categories", column: "user_id" },
  { table: "login_history", column: "user_id" },
];

/** Records we must keep, with the reason a regulator would expect to see. */
const RETAINED: Array<{ table: string; reason: string }> = [
  { table: "kyc_profiles", reason: "Customer Identification Program records — 5 years after account closure (31 CFR 1020.220)" },
  { table: "column_transfers", reason: "Payment and funds-transfer records — 5 years (31 CFR 1010.410)" },
  { table: "column_bank_accounts", reason: "Account records held by our banking partner — 5 years" },
  { table: "column_entities", reason: "Verified entity record tied to the partner bank ledger" },
  { table: "invoices", reason: "Financial/accounting records" },
  { table: "bills", reason: "Financial/accounting records" },
  { table: "reimbursements", reason: "Financial/accounting records" },
  { table: "payment_requests", reason: "Financial/accounting records" },
  { table: "support_tickets", reason: "Dispute and complaint records (Reg E)" },
  { table: "audit_logs", reason: "Security audit trail — required for SOC 2 / fraud investigation" },
];

async function writeAudit(
  actorId: string,
  actorEmail: string | null,
  action: string,
  metadata: Record<string, unknown>,
) {
  try {
    await admin.from("audit_logs").insert({
      actor_id: actorId,
      actor_email: actorEmail,
      action,
      entity_type: "user",
      entity_id: actorId,
      metadata,
    });
  } catch (e) {
    console.error("audit write failed", (e as Error).message);
  }
}

async function exportData(userId: string, email: string | null) {
  const data: Record<string, unknown> = {};
  const errors: Record<string, string> = {};

  // One query per table, run in parallel — no N+1 fan-out per row.
  await Promise.all(
    OWNED.map(async ({ table, column }) => {
      const { data: rows, error } = await admin.from(table).select("*").eq(column, userId);
      if (error) errors[table] = error.message;
      else data[table] = rows ?? [];
    }),
  );

  // payment_requests can also name the caller as the payer.
  const { data: asPayer } = await admin.from("payment_requests").select("*").eq("payer_id", userId);
  if (asPayer?.length) data["payment_requests_as_payer"] = asPayer;

  const { data: receipts } = await admin.storage.from("receipts").list(userId, { limit: 1000 });

  await writeAudit(userId, email, "privacy.export", { tables: Object.keys(data).length });

  return {
    generatedAt: new Date().toISOString(),
    subject: { userId, email },
    notice:
      "This file contains every record Glass Bank holds that is linked to your account. " +
      "Records held by our banking partner (Column N.A.) about settled payments are mirrored here " +
      "but are also retained independently by the bank under its own regulatory obligations.",
    uploadedFiles: (receipts ?? []).map((f) => ({ name: f.name, size: f.metadata?.size ?? null })),
    exportErrors: Object.keys(errors).length ? errors : undefined,
    data,
  };
}

async function deleteAccount(userId: string, email: string | null, confirmation: string) {
  if (confirmation.trim().toUpperCase() !== "DELETE MY ACCOUNT") {
    return json({ error: "Type DELETE MY ACCOUNT exactly to confirm." }, 400);
  }

  // Refuse while money is still on the ledger — closing an account with a
  // balance is not something we can silently do.
  const { data: accounts } = await admin
    .from("column_bank_accounts")
    .select("bank_account_id, balances")
    .eq("user_id", userId);

  const totalCents = (accounts ?? []).reduce((sum, a) => {
    const b = (a.balances ?? {}) as Record<string, unknown>;
    const available = Number((b.available_amount as number) ?? (b.available as number) ?? 0);
    return sum + (Number.isFinite(available) ? available : 0);
  }, 0);

  if (totalCents > 0) {
    return json(
      {
        error:
          "Your accounts still hold funds. Withdraw or transfer the remaining balance before closing your account.",
        remainingCents: totalCents,
      },
      409,
    );
  }

  const erased: Record<string, number | string> = {};
  for (const { table, column } of ERASABLE) {
    const { error, count } = await admin
      .from(table)
      .delete({ count: "exact" })
      .eq(column, userId);
    erased[table] = error ? `error: ${error.message}` : (count ?? 0);
  }

  // Stored receipt images are user content — remove them.
  try {
    const { data: files } = await admin.storage.from("receipts").list(userId, { limit: 1000 });
    if (files?.length) {
      await admin.storage.from("receipts").remove(files.map((f) => `${userId}/${f.name}`));
      erased["storage:receipts"] = files.length;
    }
  } catch (e) {
    erased["storage:receipts"] = `error: ${(e as Error).message}`;
  }

  // Anonymise the marketing/contact surface of the profile. Identity fields
  // needed for CIP retention live in kyc_profiles and are deliberately kept.
  await admin
    .from("profiles")
    .update({
      preferred_name: "Closed account",
      phone: null,
      email: null,
      occupation: null,
      employer: null,
      annual_income: null,
      address_street: null,
      address_line2: null,
      address_city: null,
      address_region: null,
      address_postal_code: null,
    })
    .eq("user_id", userId);

  // Permanently disable sign-in. We do not hard-delete the auth user because
  // retained financial rows reference it.
  const { error: banError } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: "876000h",
  });
  try {
    await admin.auth.admin.signOut(userId, "global");
  } catch { /* session may already be gone */ }

  await writeAudit(userId, email, "privacy.account_deleted", { erased, banError: banError?.message ?? null });

  return json({
    ok: true,
    erased,
    retained: RETAINED,
    message:
      "Your account is closed and sign-in is permanently disabled. Personal preferences, saved payees, " +
      "devices and uploaded files have been erased. Financial and identity records are retained for five " +
      "years as required by the Bank Secrecy Act, and are used only to answer lawful regulatory requests.",
  });
}

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
    const action = String((body as Record<string, unknown>)?.action ?? "");

    switch (action) {
      case "retention_policy":
        return json({ retained: RETAINED, erasable: ERASABLE.map((e) => e.table) });
      case "export":
        return json(await exportData(user.id, user.email ?? null));
      case "delete_account":
        return await deleteAccount(
          user.id,
          user.email ?? null,
          String((body as Record<string, unknown>)?.confirmation ?? ""),
        );
      default:
        return json({ error: `Unknown action "${action}"` }, 400);
    }
  } catch (e) {
    console.error("privacy error", (e as Error).message);
    return json({ error: (e as Error).message }, 500);
  }
});

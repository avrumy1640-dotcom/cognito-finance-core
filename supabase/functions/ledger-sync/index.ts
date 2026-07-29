// Banking provider sandbox proxy (internal).
//
// ISOLATED INTEGRATION LAYER — everything that talks to Column lives in this
// function and `column-webhook`. Deleting these two folders, the
// `column_*` tables and `src/lib/columnClient.ts` removes the integration
// entirely.
//
// SANDBOX ONLY. The API key must be a `test_` key; the function refuses to run
// with anything else so we can never accidentally touch live money.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const COLUMN_API_KEY = Deno.env.get("COLUMN_API_KEY") ?? "";
const COLUMN_BASE = "https://api.column.com";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// ---------------------------------------------------------------------------
// Column HTTP client — HTTP Basic, API key as password, blank username.
// ---------------------------------------------------------------------------
function assertSandboxKey() {
  if (!COLUMN_API_KEY) throw new Error("COLUMN_API_KEY is not configured");
  if (!COLUMN_API_KEY.startsWith("test_")) {
    throw new Error("Refusing to run: COLUMN_API_KEY is not a sandbox (test_) key");
  }
}

async function column<T = any>(
  path: string,
  init: { method?: string; body?: unknown; query?: Record<string, string | number | undefined> } = {},
): Promise<T> {
  assertSandboxKey();
  const url = new URL(COLUMN_BASE + path);
  for (const [k, v] of Object.entries(init.query ?? {})) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), {
    method: init.method ?? "GET",
    headers: {
      Authorization: "Basic " + btoa(":" + COLUMN_API_KEY),
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await res.text();
  let parsed: any = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = { raw: text }; }
  if (!res.ok) {
    const msg = parsed?.message || parsed?.code || `Column ${res.status}`;
    throw Object.assign(new Error(`${msg}`), { status: res.status, detail: parsed });
  }
  return parsed as T;
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------
const cents = (n: unknown) => (typeof n === "number" ? n : 0);

function mapBalances(acct: any) {
  const b = acct?.balances ?? {};
  return {
    available: cents(b.available_amount) / 100,
    current: cents(b.available_amount ?? 0) / 100 + cents(b.pending_amount) / 100,
    pending: cents(b.pending_amount) / 100,
    holding: cents(b.holding_amount) / 100,
    locked: cents(b.locked_amount) / 100,
  };
}

// ---------------------------------------------------------------------------
// Core flows
// ---------------------------------------------------------------------------
async function ensureEntity(userId: string) {
  const { data: existing } = await admin
    .from("column_entities").select("*").eq("user_id", userId).maybeSingle();
  if (existing) return existing;

  const [{ data: profile }, { data: kyc }] = await Promise.all([
    admin.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
    admin.from("kyc_profiles").select("*").eq("user_id", userId).maybeSingle(),
  ]);

  const first = kyc?.legal_first_name || profile?.first_name || "Test";
  const last = kyc?.legal_last_name || profile?.last_name || "User";
  const email = profile?.email || undefined;

  // Sandbox entity. We deliberately do NOT forward a real SSN; Column's sandbox
  // accepts the documented test SSN and returns a verified person.
  const payload: Record<string, unknown> = {
    first_name: first,
    last_name: last,
    email,
    ssn: "123456789",
    date_of_birth: (kyc?.date_of_birth as string | undefined) ?? "1990-01-01",
    address: {
      line_1: profile?.address_line1 || "1 Market St",
      city: profile?.city || "San Francisco",
      state: profile?.state || "CA",
      postal_code: profile?.postal_code || "94105",
      country_code: "US",
    },
  };

  const created = await column<any>("/entities/person", { method: "POST", body: payload });
  const { data: row, error } = await admin.from("column_entities").insert({
    user_id: userId,
    entity_id: created.id,
    entity_type: "person",
    verification_status: created.verification_status ?? "unverified",
    details: created,
  }).select().single();
  if (error) throw new Error(error.message);
  return row;
}

async function ensureBankAccount(userId: string, entityId: string) {
  const { data: existing } = await admin
    .from("column_bank_accounts").select("*").eq("user_id", userId).order("created_at");
  if (existing && existing.length) return existing;

  const acct = await column<any>("/bank-accounts", {
    method: "POST",
    body: { entity_id: entityId, description: "Everyday Checking", type: "CHECKING" },
  });

  let numbers: any = null;
  try {
    numbers = await column<any>(`/bank-accounts/${acct.id}/account-numbers`, {
      method: "POST",
      body: { description: "Primary" },
    });
  } catch (_) { /* account numbers are optional for read-only sync */ }

  const acctNum: string | undefined = numbers?.account_number;
  const { data: row, error } = await admin.from("column_bank_accounts").insert({
    user_id: userId,
    entity_id: entityId,
    bank_account_id: acct.id,
    account_number_id: numbers?.id ?? null,
    account_number_masked: acctNum ? `••••${acctNum.slice(-4)}` : null,
    routing_number: numbers?.routing_number ?? null,
    description: acct.description ?? "Everyday Checking",
    account_type: "checking",
    status: acct.is_closed ? "closed" : "open",
    balances: acct.balances ?? {},
  }).select().single();
  if (error) throw new Error(error.message);
  return [row];
}

async function refreshAccounts(userId: string) {
  const { data: rows } = await admin
    .from("column_bank_accounts").select("*").eq("user_id", userId).order("created_at");
  const out: any[] = [];
  for (const r of rows ?? []) {
    try {
      const live = await column<any>(`/bank-accounts/${r.bank_account_id}`);
      await admin.from("column_bank_accounts").update({
        balances: live.balances ?? {},
        status: live.is_closed ? "closed" : "open",
      }).eq("id", r.id);
      out.push({ ...r, balances: live.balances ?? {} });
    } catch {
      out.push(r);
    }
  }
  return out;
}

async function syncTransfers(userId: string, bankAccountIds: string[]) {
  if (!bankAccountIds.length) return [];
  const collected: any[] = [];
  for (const kind of ["ach", "book", "wire"] as const) {
    try {
      const list = await column<any>(`/transfers/${kind}`, { query: { limit: 100 } });
      const items: any[] = list?.transfers ?? list?.[`${kind}_transfers`] ?? list?.data ?? [];
      for (const t of items) {
        const accId = t.bank_account_id ?? t.sender_bank_account_id ?? t.receiver_bank_account_id;
        const involved =
          bankAccountIds.includes(accId) ||
          bankAccountIds.includes(t.sender_bank_account_id) ||
          bankAccountIds.includes(t.receiver_bank_account_id);
        if (!involved) continue;
        const isCredit =
          t.type === "CREDIT" ||
          bankAccountIds.includes(t.receiver_bank_account_id ?? "") ||
          t.direction === "credit";
        collected.push({
          user_id: userId,
          transfer_id: t.id,
          transfer_type: kind,
          bank_account_id: bankAccountIds.includes(accId) ? accId : bankAccountIds[0],
          status: (t.status ?? "pending").toLowerCase(),
          amount_cents: cents(t.amount),
          currency: t.currency_code ?? "USD",
          direction: isCredit ? "credit" : "debit",
          description: t.description ?? t.merchant_name ?? `${kind.toUpperCase()} transfer`,
          raw: t,
          occurred_at: t.created_at ?? new Date().toISOString(),
        });
      }
    } catch { /* a transfer type may be unavailable in sandbox */ }
  }
  if (collected.length) {
    await admin.from("column_transfers").upsert(collected, { onConflict: "transfer_id" });
  }
  const { data } = await admin
    .from("column_transfers").select("*").eq("user_id", userId)
    .order("occurred_at", { ascending: false }).limit(200);
  return data ?? [];
}

async function snapshot(userId: string, opts: { provision: boolean }) {
  let entity = null as any;
  const { data: existingEntity } = await admin
    .from("column_entities").select("*").eq("user_id", userId).maybeSingle();
  entity = existingEntity;

  if (!entity && opts.provision) entity = await ensureEntity(userId);
  if (!entity) return { provisioned: false, entity: null, accounts: [], transactions: [] };

  let accounts = await refreshAccounts(userId);
  if (!accounts.length && opts.provision) {
    accounts = await ensureBankAccount(userId, entity.entity_id);
    accounts = await refreshAccounts(userId);
  }

  const ids = accounts.map((a) => a.bank_account_id);
  const transfers = await syncTransfers(userId, ids);

  return {
    provisioned: true,
    entity: {
      entityId: entity.entity_id,
      verificationStatus: entity.verification_status,
    },
    accounts: accounts.map((a) => ({
      id: a.bank_account_id,
      name: a.description ?? "Everyday Checking",
      type: a.account_type ?? "checking",
      accountNumber: a.account_number_masked ?? "••••0000",
      routingNumber: a.routing_number ?? "",
      status: a.status === "open" ? "Active" : "Closed",
      isOverdrawn: a.is_overdrawn ?? false,
      ...mapBalances(a),
    })),
    transactions: transfers.map((t: any) => ({
      id: t.transfer_id,
      merchant: t.description ?? "Transfer",
      category: t.transfer_type === "ach" ? "Transfer" : "Bank transfer",
      amount: (t.direction === "credit" ? 1 : -1) * (Number(t.amount_cents) / 100),
      date: t.occurred_at,
      status: ["completed", "settled", "posted"].includes(t.status) ? "posted" : "pending",
      type: t.direction === "credit" ? "credit" : "debit",
      paymentMethod: t.transfer_type.toUpperCase(),
      account: t.bank_account_id,
    })),
  };
}

// ---------------------------------------------------------------------------
// Admin / cleanup utilities
// ---------------------------------------------------------------------------
async function adminList() {
  const [entities, accounts, counterparties, webhooks] = await Promise.all([
    column<any>("/entities", { query: { limit: 100 } }).catch((e) => ({ error: String(e.message) })),
    column<any>("/bank-accounts", { query: { limit: 100 } }).catch((e) => ({ error: String(e.message) })),
    column<any>("/counterparties", { query: { limit: 100 } }).catch((e) => ({ error: String(e.message) })),
    column<any>("/webhook-endpoints", { query: { limit: 100 } }).catch((e) => ({ error: String(e.message) })),
  ]);
  const pick = (r: any, k: string) => (Array.isArray(r) ? r : r?.[k] ?? r?.data ?? []);
  return {
    entities: pick(entities, "entities"),
    bankAccounts: pick(accounts, "bank_accounts"),
    counterparties: pick(counterparties, "counterparties"),
    webhookEndpoints: pick(webhooks, "webhook_endpoints"),
    errors: {
      entities: entities?.error, bankAccounts: accounts?.error,
      counterparties: counterparties?.error, webhookEndpoints: webhooks?.error,
    },
  };
}

const RESOURCE_PATH: Record<string, string> = {
  entity: "/entities",
  "bank-account": "/bank-accounts",
  counterparty: "/counterparties",
  "webhook-endpoint": "/webhook-endpoints",
};

async function adminDelete(resource: string, id: string) {
  const base = RESOURCE_PATH[resource];
  if (!base) throw new Error(`Unknown resource "${resource}"`);
  if (!/^[A-Za-z0-9_\-]+$/.test(id)) throw new Error("Invalid id");
  await column(`${base}/${id}`, { method: "DELETE" });
  if (resource === "entity") await admin.from("column_entities").delete().eq("entity_id", id);
  if (resource === "bank-account") {
    await admin.from("column_transfers").delete().eq("bank_account_id", id);
    await admin.from("column_bank_accounts").delete().eq("bank_account_id", id);
  }
  return { deleted: { resource, id } };
}

async function adminWipe(opts: { includeWebhooks?: boolean }) {
  const listed = await adminList();
  const results: any[] = [];
  const run = async (resource: string, items: any[]) => {
    for (const item of items ?? []) {
      const id = item?.id;
      if (!id) continue;
      try { await adminDelete(resource, id); results.push({ resource, id, ok: true }); }
      catch (e) { results.push({ resource, id, ok: false, error: (e as Error).message }); }
    }
  };
  // Order matters: dependants first.
  await run("counterparty", listed.counterparties);
  await run("bank-account", listed.bankAccounts);
  await run("entity", listed.entities);
  if (opts.includeWebhooks) await run("webhook-endpoint", listed.webhookEndpoints);
  // Local mirror
  await admin.from("column_transfers").delete().neq("transfer_id", "");
  await admin.from("column_bank_accounts").delete().neq("bank_account_id", "");
  await admin.from("column_entities").delete().neq("entity_id", "");
  return { wiped: results.length, results };
}

// ---------------------------------------------------------------------------
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
    const action = String(body?.action ?? "");

    const isAdminAction = action.startsWith("admin_");
    if (isAdminAction) {
      const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!isAdmin) return json({ error: "Forbidden" }, 403);
    }

    switch (action) {
      case "status": {
        const { data: entity } = await admin
          .from("column_entities").select("entity_id, verification_status")
          .eq("user_id", user.id).maybeSingle();
        return json({
          sandbox: COLUMN_API_KEY.startsWith("test_"),
          configured: !!COLUMN_API_KEY,
          entity: entity ?? null,
        });
      }
      case "provision":
        return json(await snapshot(user.id, { provision: true }));
      case "sync":
        return json(await snapshot(user.id, { provision: false }));
      case "admin_list":
        return json(await adminList());
      case "admin_delete":
        return json(await adminDelete(String(body.resource ?? ""), String(body.id ?? "")));
      case "admin_wipe":
        return json(await adminWipe({ includeWebhooks: !!body.includeWebhooks }));
      case "admin_local":
        return json({
          entities: (await admin.from("column_entities").select("*").limit(200)).data ?? [],
          accounts: (await admin.from("column_bank_accounts").select("*").limit(200)).data ?? [],
          transfers: (await admin.from("column_transfers").select("*").limit(100)).data ?? [],
          events: (await admin.from("webhook_events").select("*").eq("provider", "column")
            .order("received_at", { ascending: false }).limit(50)).data ?? [],
        });
      default:
        return json({ error: `Unknown action "${action}"` }, 400);
    }
  } catch (e) {
    const err = e as Error & { status?: number };
    console.error("ledger-sync error", err.message);
    return json({ error: err.message }, err.status && err.status < 500 ? 400 : 500);
  }
});

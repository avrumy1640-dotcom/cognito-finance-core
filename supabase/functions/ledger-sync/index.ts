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
import { rateLimit, tooManyRequests } from "../_shared/rateLimit.ts";

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

  const first = kyc?.legal_first_name || profile?.first_name || "Sandbox";
  const last = kyc?.legal_last_name || profile?.last_name || "Tester";
  const email = profile?.email || undefined;

  // Sandbox entity. We deliberately do NOT forward a real SSN; the sandbox
  // accepts the documented test SSN and returns a verified person.
  const payload: Record<string, unknown> = {
    first_name: first,
    last_name: last,
    email,
    ssn: "123456789",
    date_of_birth: (kyc?.date_of_birth as string | undefined) ?? "1990-01-01",
    address: {
      line_1: kyc?.street || profile?.address_line1 || "1 Market St",
      city: kyc?.city || profile?.city || "San Francisco",
      state: kyc?.region || profile?.state || "CA",
      postal_code: kyc?.postal_code || profile?.postal_code || "94105",
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

  // Mirror the provider's verification verdict back onto the KYC record so the
  // app's gating reflects the real upstream decision.
  await syncKycStatus(userId, created.verification_status);
  return row;
}

/** Maps the provider verification verdict onto our own kyc_profiles status. */
async function syncKycStatus(userId: string, verification?: string) {
  const v = String(verification ?? "").toLowerCase();
  const status = v === "verified" ? "verified"
    : v === "denied" || v === "rejected" ? "rejected"
    : v === "manual_review" || v === "pending" ? "pending"
    : null;
  if (!status) return;
  await admin.from("kyc_profiles").update({ status }).eq("user_id", userId);
}

async function createAccount(userId: string, entityId: string, kind: "checking" | "savings") {
  const description = kind === "checking" ? "Everyday Checking" : "Savings";
  const acct = await column<any>("/bank-accounts", {
    method: "POST",
    body: { entity_id: entityId, description, type: kind.toUpperCase() },
  });

  // The default account number is created with the account; fall back to
  // explicitly minting one if the sandbox did not return any.
  let numbers: any = null;
  try {
    const list = await column<any>(`/bank-accounts/${acct.id}/account-numbers`);
    numbers = (list?.account_numbers ?? list?.data ?? [])[0] ?? null;
  } catch { /* ignore */ }
  if (!numbers) {
    try {
      numbers = await column<any>(`/bank-accounts/${acct.id}/account-numbers`, {
        method: "POST", body: { description: "Primary" },
      });
    } catch { /* account numbers are optional for read-only sync */ }
  }

  const acctNum: string | undefined = numbers?.account_number;
  const { data: row, error } = await admin.from("column_bank_accounts").insert({
    user_id: userId,
    entity_id: entityId,
    bank_account_id: acct.id,
    account_number_id: numbers?.id ?? null,
    account_number_masked: acctNum ? `••••${acctNum.slice(-4)}` : null,
    routing_number: numbers?.routing_number ?? acct.routing_number ?? null,
    description: acct.description ?? description,
    account_type: kind,
    status: acct.is_closed ? "closed" : "open",
    balances: acct.balances ?? {},
  }).select().single();
  if (error) throw new Error(error.message);
  return row;
}

async function ensureBankAccount(userId: string, entityId: string) {
  const { data: existing } = await admin
    .from("column_bank_accounts").select("*").eq("user_id", userId).order("created_at");
  const have = new Set((existing ?? []).map((r: any) => r.account_type));
  const rows = [...(existing ?? [])];
  for (const kind of ["checking", "savings"] as const) {
    if (have.has(kind)) continue;
    try {
      rows.push(await createAccount(userId, entityId, kind));
    } catch (e) {
      // A savings sub-account may not be supported — checking must succeed.
      if (kind === "checking") throw e;
      console.warn("savings account not created:", (e as Error).message);
    }
  }
  return rows;
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
// Money movement — every action below hits the provider for real.
// ---------------------------------------------------------------------------
const toCents = (n: unknown) => {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) throw new Error("Amount must be greater than zero");
  return Math.round(v * 100);
};

async function accountsFor(userId: string) {
  const { data } = await admin.from("column_bank_accounts")
    .select("*").eq("user_id", userId).order("created_at");
  if (!data?.length) throw new Error("No account yet — finish verification first");
  return data;
}

function pickAccount(rows: any[], which?: string) {
  if (!which) return rows[0];
  return rows.find((r) => r.account_type === which) ?? rows.find((r) => r.bank_account_id === which) ?? rows[0];
}

async function ensureCounterparty(userId: string, args: {
  name: string; routingNumber: string; accountNumber: string; wire?: boolean;
}) {
  const routing = String(args.routingNumber ?? "").replace(/\D/g, "");
  const account = String(args.accountNumber ?? "").replace(/\s/g, "");
  if (routing.length !== 9) throw new Error("Routing number must be 9 digits");
  if (!account) throw new Error("Account number is required");

  let cachedId: string | null = null;
  try {
    const { data: cached } = await admin.from("column_counterparties")
      .select("counterparty_id").eq("user_id", userId)
      .eq("routing_number", routing).eq("account_number_last4", account.slice(-4))
      .maybeSingle();
    cachedId = cached?.counterparty_id ?? null;
  } catch { /* mirror table optional */ }
  if (cachedId) return cachedId;


  const cp = await column<any>("/counterparties", {
    method: "POST",
    body: {
      routing_number: routing,
      account_number: account,
      name: args.name?.slice(0, 64) || "Counterparty",
      ...(args.wire ? { wire: { beneficiary_name: args.name?.slice(0, 64) || "Counterparty" } } : {}),
    },
  });
  try {
    await admin.from("column_counterparties").insert({
      user_id: userId, counterparty_id: cp.id, name: args.name,
      routing_number: routing, account_number_last4: account.slice(-4), raw: cp,
    });
  } catch { /* mirror table is optional */ }
  return cp.id as string;
}

async function recordTransfer(userId: string, kind: string, bankAccountId: string, t: any, direction: "credit" | "debit", description: string) {
  await admin.from("column_transfers").upsert({
    user_id: userId,
    transfer_id: t.id,
    transfer_type: kind,
    bank_account_id: bankAccountId,
    status: String(t.status ?? "pending").toLowerCase(),
    amount_cents: cents(t.amount),
    currency: t.currency_code ?? "USD",
    direction,
    description,
    raw: t,
    occurred_at: t.created_at ?? new Date().toISOString(),
  }, { onConflict: "transfer_id" });
}

async function doTransfer(userId: string, body: any) {
  const rows = await accountsFor(userId);
  const kind = String(body.kind ?? "book");
  const amount = toCents(body.amount);
  const description = String(body.description ?? "Transfer").slice(0, 120);

  if (kind === "book") {
    const from = pickAccount(rows, body.from);
    const to = pickAccount(rows, body.to);
    if (!from || !to || from.bank_account_id === to.bank_account_id) {
      throw new Error("Choose two different accounts");
    }
    const t = await column<any>("/transfers/book", {
      method: "POST",
      body: {
        sender_bank_account_id: from.bank_account_id,
        receiver_bank_account_id: to.bank_account_id,
        amount, currency_code: "USD", description,
      },
    });
    await recordTransfer(userId, "book", from.bank_account_id, t, "debit", description);
    await recordTransfer(userId, "book", to.bank_account_id, { ...t, id: `${t.id}-in` }, "credit", description);
    return { transferId: t.id, status: t.status };
  }

  if (kind === "ach" || kind === "ach_pull") {
    const from = pickAccount(rows, body.from ?? "checking");
    const counterpartyId = body.counterpartyId
      ?? await ensureCounterparty(userId, {
        name: body.name ?? "External account",
        routingNumber: body.routingNumber,
        accountNumber: body.accountNumber,
      });
    // CREDIT pushes money out; DEBIT pulls money in (sandbox funding).
    const type = kind === "ach_pull" ? "DEBIT" : "CREDIT";
    const t = await column<any>("/transfers/ach", {
      method: "POST",
      body: {
        bank_account_id: from.bank_account_id,
        counterparty_id: counterpartyId,
        type, amount, currency_code: "USD",
        entry_class_code: "PPD",
        description: description.slice(0, 10) || "GLASSBNK",
      },
    });
    await recordTransfer(userId, "ach", from.bank_account_id, t, type === "DEBIT" ? "credit" : "debit", description);
    return { transferId: t.id, status: t.status };
  }

  if (kind === "wire") {
    const from = pickAccount(rows, body.from ?? "checking");
    const counterpartyId = body.counterpartyId
      ?? await ensureCounterparty(userId, {
        name: body.name ?? "Beneficiary",
        routingNumber: body.routingNumber,
        accountNumber: body.accountNumber,
        wire: true,
      });
    const t = await column<any>("/transfers/wire", {
      method: "POST",
      body: {
        bank_account_id: from.bank_account_id,
        counterparty_id: counterpartyId,
        amount, currency_code: "USD", description,
      },
    });
    await recordTransfer(userId, "wire", from.bank_account_id, t, "debit", description);
    return { transferId: t.id, status: t.status };
  }

  throw new Error(`Unsupported transfer kind "${kind}"`);
}

/** Connectivity probe — proves the credentials work without mutating anything. */
async function diagnose() {
  const out: Record<string, unknown> = {
    configured: !!COLUMN_API_KEY,
    sandbox: COLUMN_API_KEY.startsWith("test_"),
    webhookSecret: !!Deno.env.get("COLUMN_WEBHOOK_SECRET"),
  };
  try {
    const res = await column<any>("/entities", { query: { limit: 1 } });
    out.reachable = true;
    out.entityCount = (res?.entities ?? res?.data ?? []).length;
  } catch (e) {
    out.reachable = false;
    out.error = (e as Error).message;
  }
  return out;
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

    // Rate limit per caller. Admin/mutating actions get a much tighter budget
    // than read-only status/sync polling.
    const isMutating = isAdminAction || action === "provision" || action === "transfer";
    const rl = rateLimit(`ledger:${user.id}:${isMutating ? "write" : "read"}`, isMutating ? 10 : 60);
    if (!rl.allowed) return tooManyRequests(rl.retryAfter, corsHeaders);

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
      case "diagnose":
        return json(await diagnose());
      case "provision":
        return json(await snapshot(user.id, { provision: true }));
      case "sync":
        return json(await snapshot(user.id, { provision: false }));
      case "transfer": {
        const result = await doTransfer(user.id, body);
        return json({ ...result, snapshot: await snapshot(user.id, { provision: false }) });
      }

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

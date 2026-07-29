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

/**
 * Column error shape: { type, code, message, documentation_url, details }.
 * We keep `code` alongside the message so the UI can map known codes
 * (transfer_non_sufficient_fund, entity_not_verified, …) to real copy.
 */
export interface ColumnError extends Error {
  status?: number;
  code?: string;
  type?: string;
  documentationUrl?: string;
  details?: unknown;
}

async function column<T = any>(
  path: string,
  init: {
    method?: string;
    body?: unknown;
    query?: Record<string, string | number | undefined>;
    /**
     * Sent as `Idempotency-Key`. Required on every creation call so a
     * double-tap or a retry after a timeout can never create a second
     * entity / account / transfer. ASCII, ≤255 chars.
     */
    idempotencyKey?: string;
    /** Raw multipart body (evidence upload) — skips JSON encoding. */
    form?: FormData;
  } = {},
): Promise<T> {
  assertSandboxKey();
  const url = new URL(COLUMN_BASE + path);
  for (const [k, v] of Object.entries(init.query ?? {})) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  const headers: Record<string, string> = {
    Authorization: "Basic " + btoa(":" + COLUMN_API_KEY),
  };
  if (!init.form) headers["Content-Type"] = "application/json";
  if (init.idempotencyKey) headers["Idempotency-Key"] = idempotencyKey(init.idempotencyKey);

  const res = await fetch(url.toString(), {
    method: init.method ?? "GET",
    headers,
    body: init.form ?? (init.body === undefined ? undefined : JSON.stringify(init.body)),
  });
  const text = await res.text();
  let parsed: any = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = { raw: text }; }
  if (!res.ok) {
    const msg = parsed?.message || parsed?.code || `Column ${res.status}`;
    console.error("provider call failed", init.method ?? "GET", path, res.status, JSON.stringify(parsed));
    throw Object.assign(new Error(`${msg}`), {
      status: res.status,
      code: parsed?.code,
      type: parsed?.type,
      documentationUrl: parsed?.documentation_url,
      details: parsed?.details,
      detail: parsed,
    }) as ColumnError;
  }
  return parsed as T;
}

/** Idempotency keys must be ASCII printable and ≤255 chars. */
function idempotencyKey(raw: string) {
  return raw.replace(/[^\x20-\x7E]/g, "-").slice(0, 255);
}


// ---------------------------------------------------------------------------
// Cursor pagination.
//
// Column list endpoints are cursor-based (NOT offset-based): a response carries
// `has_more`, the items are in reverse-chronological order, and the next page is
// requested with `starting_after: <id of the last item on this page>`. Fetching a
// single page silently truncates once an account passes `limit` records, so every
// list call in this file must go through this helper.
// ---------------------------------------------------------------------------
interface PaginateOpts {
  /** Response key holding the array (e.g. "entities"). Falls back to `data`. */
  key?: string;
  /** Records per request. Column caps this at 100. */
  pageSize?: number;
  /** Hard safety cap so a misbehaving `has_more` can never loop forever. */
  max?: number;
  query?: Record<string, string | number | undefined>;
  /**
   * Called after each page. Return `true` to stop early — used by the transfer
   * sync to stop as soon as it reaches records it already has locally.
   */
  stopAfterPage?: (page: any[]) => boolean;
}

function pickList(res: any, key?: string): any[] {
  if (Array.isArray(res)) return res;
  if (key && Array.isArray(res?.[key])) return res[key];
  if (Array.isArray(res?.data)) return res.data;
  // Last resort: first array-valued property on the response.
  for (const v of Object.values(res ?? {})) if (Array.isArray(v)) return v as any[];
  return [];
}

async function columnPaginated<T = any>(path: string, opts: PaginateOpts = {}): Promise<T[]> {
  const pageSize = Math.min(opts.pageSize ?? 100, 100);
  const max = opts.max ?? 1000;
  const out: T[] = [];
  let startingAfter: string | undefined;

  // The `has_more === false` guard is the normal exit; `max` and an empty/
  // non-advancing page are the defensive ones.
  for (let guard = 0; guard < Math.ceil(max / pageSize) + 1; guard++) {
    const res = await column<any>(path, {
      query: { ...opts.query, limit: pageSize, starting_after: startingAfter },
    });
    const page = pickList(res, opts.key);
    out.push(...page);
    if (opts.stopAfterPage?.(page)) break;
    const last = page[page.length - 1] as any;
    const nextCursor = last?.id;
    if (!page.length || !nextCursor || nextCursor === startingAfter) break;
    if (res?.has_more !== true) break;
    if (out.length >= max) {
      console.warn(`columnPaginated: hit safety cap of ${max} records for ${path}`);
      break;
    }
    startingAfter = String(nextCursor);
  }
  return out;
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------
const cents = (n: unknown) => (typeof n === "number" ? n : 0);

/**
 * Column bank-account balances.
 *
 * The docs name these `available_balance` / `pending_balance` /
 * `locked_balance`, but the live sandbox actually returns
 * `available_amount` / `pending_amount` / `locked_amount` (verified against a
 * real mirrored account). Reading only the documented names silently produced
 * $0 everywhere, so we accept BOTH spellings and take whichever is present.
 * `current` = available + pending.
 */
function balanceField(b: any, name: string) {
  const v = b?.[`${name}_balance`];
  return typeof v === "number" ? v : cents(b?.[`${name}_amount`]);
}

function mapBalances(acct: any) {
  const b = acct?.balances ?? {};
  const available = balanceField(b, "available") / 100;
  const pending = balanceField(b, "pending") / 100;
  return {
    available,
    current: available + pending,
    pending,
    locked: balanceField(b, "locked") / 100,
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
  // `pep_status` is required by Column's person payload; we do not ask the
  // customer a politically-exposed-person question yet, so "not_checked".
  const payload: Record<string, unknown> = {
    first_name: first,
    last_name: last,
    email,
    ssn: "123456789",
    date_of_birth: (kyc?.date_of_birth as string | undefined) ?? "1990-01-01",
    pep_status: "not_checked",
    address: {
      line_1: kyc?.street || profile?.address_line1 || "1 Market St",
      city: kyc?.city || profile?.city || "San Francisco",
      state: kyc?.region || profile?.state || "CA",
      postal_code: kyc?.postal_code || profile?.postal_code || "94105",
      country_code: "US",
    },
  };

  // One entity per user, forever — the key is the user id.
  const created = await column<any>("/entities/person", {
    method: "POST", body: payload, idempotencyKey: `entity-person-${userId}`,
  });

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
  // Keyed on user + kind: a retry can never open a second checking account.
  const acct = await column<any>("/bank-accounts", {
    method: "POST",
    body: { entity_id: entityId, description },
    idempotencyKey: `bank-account-${userId}-${kind}`,
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
        method: "POST",
        body: { description: "Primary" },
        idempotencyKey: `account-number-${acct.id}-primary`,
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

const TX_PAGE_SIZE = 50;

/**
 * Pulls every transfer of every kind for the user's accounts.
 *
 * Efficiency: transfers come back newest-first, so on a normal sync we stop
 * paginating as soon as a page is entirely older than the newest record we
 * already mirrored locally. A full walk (up to the safety cap) only happens on
 * the first sync, or when we still hold transfers in a non-terminal status that
 * are older than that watermark and therefore need their status re-read.
 */
async function syncTransfers(
  userId: string,
  bankAccountIds: string[],
  page: { limit?: number; offset?: number } = {},
) {
  if (!bankAccountIds.length) return { rows: [], hasMore: false, total: 0 };

  const [{ data: newest }, { count: stalePending }] = await Promise.all([
    admin.from("column_transfers").select("occurred_at").eq("user_id", userId)
      .order("occurred_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("column_transfers").select("transfer_id", { count: "exact", head: true })
      .eq("user_id", userId).not("status", "in", '("completed","settled","posted","returned","canceled")'),
  ]);
  const watermark = newest?.occurred_at ? Date.parse(newest.occurred_at as string) : null;
  const fullWalk = watermark === null || (stalePending ?? 0) > 0;

  const collected: any[] = [];
  for (const kind of ["ach", "book", "wire"] as const) {
    try {
      const items = await columnPaginated<any>(`/transfers/${kind}`, {
        key: `${kind}_transfers`,
        pageSize: 100,
        max: 1000,
        // Incremental stop: once the oldest row on this page predates everything
        // we already have, later pages hold nothing new.
        stopAfterPage: (pageItems) => {
          if (fullWalk || !pageItems.length) return false;
          const oldest = pageItems[pageItems.length - 1]?.created_at;
          return !!oldest && Date.parse(oldest) <= (watermark as number);
        },
      });
      for (const t of items) {
        const sender = t.sender_bank_account_id ?? null;
        const receiver = t.receiver_bank_account_id ?? null;
        const accId = t.bank_account_id ?? sender ?? receiver;
        const weSend = !!sender && bankAccountIds.includes(sender);
        const weReceive = !!receiver && bankAccountIds.includes(receiver);
        const involved = weSend || weReceive || bankAccountIds.includes(accId);
        if (!involved) continue;

        const dir = String(t.direction ?? t.type ?? "").toLowerCase();
        // ACH semantics are inverted relative to intuition: an ACH DEBIT pulls
        // money INTO our account, a CREDIT pushes it out. Book/wire transfers
        // are keyed off which side of the transfer we hold; incoming wires only
        // carry a direction/CREDIT marker on the receiving account.
        const isCredit = kind === "ach"
          ? String(t.type ?? "").toUpperCase() === "DEBIT"
          : weReceive || (!weSend && (dir === "credit" || t.is_incoming === true));

        const base = {
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
        };

        if (weSend && weReceive) {
          // Internal book transfer: one Column record, but the customer should
          // see both sides — money leaving one account and landing in the other.
          collected.push({ ...base, transfer_id: `${t.id}:out`, bank_account_id: sender!, direction: "debit" });
          collected.push({ ...base, transfer_id: `${t.id}:in`, bank_account_id: receiver!, direction: "credit" });
        } else {
          collected.push({ ...base, bank_account_id: weReceive ? receiver! : weSend ? sender! : base.bank_account_id });
        }
      }
    } catch (e) {
      // A transfer type may be unavailable in sandbox — log rather than swallow.
      console.warn(`transfer sync failed for ${kind}:`, (e as Error).message);
    }
  }
  if (collected.length) {
    await admin.from("column_transfers").upsert(collected, { onConflict: "transfer_id" });
  }

  // Select-back is paged (load-more), not a hard cap, so the Activity feed can
  // walk the full history the same way the rest of the app paginates.
  const limit = Math.min(Math.max(Number(page.limit) || TX_PAGE_SIZE, 1), 500);
  const offset = Math.max(Number(page.offset) || 0, 0);
  const { data, count } = await admin
    .from("column_transfers").select("*", { count: "exact" }).eq("user_id", userId)
    .order("occurred_at", { ascending: false })
    .range(offset, offset + limit - 1);
  const rows = data ?? [];
  return { rows, hasMore: offset + rows.length < (count ?? rows.length), total: count ?? rows.length };
}

async function snapshot(
  userId: string,
  opts: { provision: boolean; limit?: number; offset?: number },
) {
  let entity = null as any;
  const { data: existingEntity } = await admin
    .from("column_entities").select("*").eq("user_id", userId).maybeSingle();
  entity = existingEntity;

  if (!entity && opts.provision) entity = await ensureEntity(userId);
  if (!entity) {
    return {
      provisioned: false, entity: null, accounts: [], transactions: [],
      transactionsHasMore: false, transactionsTotal: 0, transactionsOffset: 0,
    };
  }

  let accounts = await refreshAccounts(userId);
  if (!accounts.length && opts.provision) {
    accounts = await ensureBankAccount(userId, entity.entity_id);
    accounts = await refreshAccounts(userId);
  }

  const ids = accounts.map((a) => a.bank_account_id);
  const { rows: transfers, hasMore, total } = await syncTransfers(userId, ids, {
    limit: opts.limit, offset: opts.offset,
  });

  return {
    provisioned: true,
    transactionsHasMore: hasMore,
    transactionsTotal: total,
    transactionsOffset: Math.max(Number(opts.offset) || 0, 0),
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
      // The partner's real lifecycle state, surfaced verbatim so the UI can
      // show "In review" / "Returned" instead of a flat "pending".
      providerStatus: t.status,
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

export interface WireAddress {
  line1?: string; city?: string; state?: string; postalCode?: string; countryCode?: string;
}

async function ensureCounterparty(userId: string, args: {
  name: string; routingNumber: string; accountNumber: string;
  wire?: boolean; address?: WireAddress;
}) {
  const routing = String(args.routingNumber ?? "").replace(/\D/g, "");
  const account = String(args.accountNumber ?? "").replace(/\s/g, "");
  if (routing.length !== 9) throw new Error("Routing number must be 9 digits");
  if (!account) throw new Error("Account number is required");

  const name = args.name?.slice(0, 64) || "Counterparty";

  // Wires are OFAC-screened on the beneficiary, so Column requires a full
  // beneficiary address. ACH counterparties do not.
  let wireBlock: Record<string, unknown> | undefined;
  if (args.wire) {
    const a = args.address ?? {};
    const missing = ["line1", "city", "state", "postalCode"].filter((k) => !String((a as any)[k] ?? "").trim());
    if (missing.length) {
      throw new Error("Wire recipients need a full beneficiary address (street, city, state, ZIP)");
    }
    wireBlock = {
      beneficiary_name: name,
      beneficiary_address: {
        line_1: String(a.line1).slice(0, 100),
        city: String(a.city).slice(0, 60),
        state: String(a.state).toUpperCase().slice(0, 3),
        postal_code: String(a.postalCode).slice(0, 12),
        country_code: (a.countryCode || "US").toUpperCase().slice(0, 2),
      },
    };
  }

  let cachedId: string | null = null;
  try {
    const { data: cached } = await admin.from("column_counterparties")
      .select("counterparty_id").eq("user_id", userId)
      .eq("routing_number", routing).eq("account_number_last4", account.slice(-4))
      .maybeSingle();
    cachedId = cached?.counterparty_id ?? null;
  } catch { /* mirror table optional */ }
  // A cached ACH-only counterparty has no wire block, so re-create for wires.
  if (cachedId && !args.wire) return cachedId;

  const cp = await column<any>("/counterparties", {
    method: "POST",
    body: {
      routing_number: routing,
      account_number: account,
      name,
      ...(wireBlock ? { wire: wireBlock } : {}),
    },
    idempotencyKey: `counterparty-${userId}-${routing}-${account.slice(-4)}-${args.wire ? "wire" : "ach"}`,
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

/**
 * Idempotency key for a money movement.
 *
 * The client mints a `requestId` once, before the first attempt, and reuses it
 * on retries — so a retried request replays instead of double-sending, while
 * two genuinely separate transfers (different requestId) never collide. The
 * real inputs are folded in so a mutated payload can't ride an old key.
 */
async function transferKey(userId: string, kind: string, amount: number, dest: string, requestId?: string) {
  const seed = [userId, kind, amount, dest, requestId ?? crypto.randomUUID()].join("|");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(seed));
  return "tx-" + Array.from(new Uint8Array(digest)).slice(0, 16)
    .map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function doTransfer(userId: string, body: any) {
  const rows = await accountsFor(userId);
  const kind = String(body.kind ?? "book");
  const amount = toCents(body.amount);
  const description = String(body.description ?? "Transfer").slice(0, 120);
  const requestId = typeof body.requestId === "string" ? body.requestId.slice(0, 64) : undefined;

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
      idempotencyKey: await transferKey(userId, "book", amount, to.bank_account_id, requestId),
    });
    // Same leg IDs the sync uses, so the mirrored rows update in place
    // instead of appearing twice once Column reports the transfer back.
    await recordTransfer(userId, "book", from.bank_account_id, { ...t, id: `${t.id}:out` }, "debit", description);
    await recordTransfer(userId, "book", to.bank_account_id, { ...t, id: `${t.id}:in` }, "credit", description);
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
      idempotencyKey: await transferKey(userId, kind, amount, counterpartyId, requestId),
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
        address: {
          line1: body.beneficiaryLine1, city: body.beneficiaryCity,
          state: body.beneficiaryState, postalCode: body.beneficiaryPostalCode,
          countryCode: body.beneficiaryCountry,
        },
      });
    const t = await column<any>("/transfers/wire", {
      method: "POST",
      body: {
        bank_account_id: from.bank_account_id,
        counterparty_id: counterpartyId,
        amount, currency_code: "USD", description,
      },
      idempotencyKey: await transferKey(userId, "wire", amount, counterpartyId, requestId),
    });
    await recordTransfer(userId, "wire", from.bank_account_id, t, "debit", description);
    return { transferId: t.id, status: t.status };
  }

  throw new Error(`Unsupported transfer kind "${kind}"`);
}

/**
 * Uploads a KYC document to Column and links it to the caller's entity as
 * verification evidence in a single multipart call.
 */
async function submitEvidence(userId: string, body: any) {
  const { data: entity } = await admin.from("column_entities")
    .select("entity_id").eq("user_id", userId).maybeSingle();
  if (!entity) throw new Error("Finish verification first — no entity to attach evidence to");

  const dataUrl = String(body.dataUrl ?? "");
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(dataUrl);
  if (!match) throw new Error("Unsupported file — re-take the photo and try again");
  const [, mime, b64] = match;
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  if (bytes.byteLength > 8 * 1024 * 1024) throw new Error("File is too large (max 8 MB)");

  const documentType = String(body.documentType ?? "drivers_license").slice(0, 64);
  const ext = mime.includes("png") ? "png" : mime.includes("pdf") ? "pdf" : "jpg";

  const form = new FormData();
  form.append("file", new Blob([bytes], { type: mime }), `${documentType}.${ext}`);
  form.append("evidence_type", "file");
  form.append("purposes", String(body.purpose ?? "identity_verification"));
  form.append("document_type", documentType);

  const res = await column<any>(`/entities/${entity.entity_id}/documents`, {
    method: "POST",
    form,
    idempotencyKey: `evidence-${userId}-${documentType}-${bytes.byteLength}`,
  });
  return { documentId: res?.id ?? null, entityId: entity.entity_id, status: res?.status ?? "submitted" };
}

/** Compliance view: exactly which required fields Column is still waiting on. */
async function entityCompliance(entityId: string) {
  if (!/^[A-Za-z0-9_\-]+$/.test(entityId)) throw new Error("Invalid entity id");
  return await column<any>(`/entities/${entityId}/compliance`);
}


/**
 * Sandbox-only webhook self-test. Signs a synthetic event with the same secret
 * our receiver verifies against and posts it to the receiver, so we can prove
 * the end-to-end webhook path works. Scoped to the caller's own entity, and
 * refuses to run against anything but a sandbox key.
 */
async function testWebhook(userId: string) {
  assertSandboxKey();
  const secret = Deno.env.get("COLUMN_WEBHOOK_SECRET") ?? "";
  if (!secret) throw new Error("COLUMN_WEBHOOK_SECRET is not configured");
  const { data: entity } = await admin.from("column_entities")
    .select("entity_id").eq("user_id", userId).maybeSingle();
  if (!entity) throw new Error("No entity to test against");

  const body = JSON.stringify({
    id: `evt_selftest_${crypto.randomUUID()}`,
    type: "entity.verified",
    data: { id: entity.entity_id, verification_status: "verified", self_test: true },
  });
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const signature = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0")).join("");

  const res = await fetch(`${SUPABASE_URL}/functions/v1/column-webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Column-Signature": signature },
    body,
  });
  return { status: res.status, response: await res.json().catch(() => null) };
}

/** Connectivity probe — proves the credentials work without mutating anything. */
async function diagnose() {
  const out: Record<string, unknown> = {
    configured: !!COLUMN_API_KEY,
    sandbox: COLUMN_API_KEY.startsWith("test_"),
    webhookSecret: !!Deno.env.get("COLUMN_WEBHOOK_SECRET"),
  };
  try {
    // Probe only — a single record is enough to prove credentials work.
    const res = await column<any>("/entities", { query: { limit: 1 } });
    out.reachable = true;
    out.entityCount = pickList(res, "entities").length;
    // Endpoint lists can exceed one page, and `webhookRegistered` must consider
    // all of them, so this one is fully paginated.
    const list = await columnPaginated<any>("/webhook-endpoints", {
      key: "webhook_endpoints", max: 500,
    }).catch(() => [] as any[]);
    out.webhookEndpoints = list.map((h) => ({ id: h.id, url: h.url, enabled: h.enabled ?? true }));
    out.webhookRegistered = list.some((h) => String(h.url ?? "").includes("column-webhook"));
  } catch (e) {
    out.reachable = false;
    out.error = (e as Error).message;
  }
  return out;
}

/**
 * Registers (or re-points) the webhook endpoint for this deployment so Column
 * actually calls back into the app. Idempotent: if an endpoint already exists
 * for our URL it is returned untouched.
 */
async function registerWebhook(events?: string[]) {
  const url = `${SUPABASE_URL}/functions/v1/column-webhook`;
  const existing = await columnPaginated<any>("/webhook-endpoints", {
    key: "webhook_endpoints", max: 500,
  }).catch(() => [] as any[]);
  const match = existing.find((h) => String(h.url ?? "") === url);
  if (match) return { created: false, endpoint: match, url };

  const created = await column<any>("/webhook-endpoints", {
    method: "POST",
    body: {
      url,
      description: "Glass Bank sandbox receiver",
      // Sandbox: subscribe to everything so no callback is ever missed.
      enabled_events: events?.length ? events : ["*"],
    },
    idempotencyKey: `webhook-endpoint-${url}`,
  });
  return { created: true, endpoint: created, url };
}

/**
 * Sandbox-only unhappy-path simulator. Column returns an ACH credit when the
 * counterparty name is one of the documented magic values, which fires the
 * real `ach.outgoing_transfer.returned` webhook back at us.
 */
const ACH_RETURN_NAMES = ["RETURN_NSF", "RETURN_ACCOUNT_CLOSED", "RETURN_STOP_PAYMENT", "RETURN_UNAUTH"];

async function simulateAchReturn(userId: string, body: any) {
  assertSandboxKey();
  const magic = String(body.receiverName ?? "RETURN_NSF").toUpperCase();
  if (!ACH_RETURN_NAMES.includes(magic)) throw new Error(`Unknown return code "${magic}"`);
  const amount = body.amount ? toCents(body.amount) : 1500;

  const rows = await accountsFor(userId);
  const from = pickAccount(rows, "checking");
  const counterpartyId = await ensureCounterparty(userId, {
    name: magic,
    routingNumber: String(body.routingNumber ?? "021000021"),
    accountNumber: String(body.accountNumber ?? "1234567890"),
  });
  const t = await column<any>("/transfers/ach", {
    method: "POST",
    body: {
      bank_account_id: from.bank_account_id,
      counterparty_id: counterpartyId,
      type: "CREDIT",
      amount,
      currency_code: "USD",
      entry_class_code: "PPD",
      description: "SIMRTN",
    },
    idempotencyKey: `sim-return-${userId}-${magic}-${crypto.randomUUID()}`,
  });
  await recordTransfer(userId, "ach", from.bank_account_id, t, "debit", `Simulated ${magic}`);

  // Sandbox ACH only returns once the transfer has actually settled through the
  // simulated Fed. Force settlement so the return (and its webhook) fires now
  // instead of whenever the sandbox batch window next opens.
  let settled = false;
  try {
    await column<any>("/simulate/transfers/ach/settle", {
      method: "POST",
      body: { ach_transfer_id: t.id },
    });
    settled = true;
  } catch (e) {
    console.warn("could not force ACH settlement", (e as Error).message);
  }
  return { transferId: t.id, status: t.status, expectedReturn: magic, settled };
}

/** Sandbox-only incoming-wire simulator. */
async function simulateIncomingWire(userId: string, body: any) {
  assertSandboxKey();
  const amount = body.amount ? toCents(body.amount) : 50000;
  const rows = await accountsFor(userId);
  const to = pickAccount(rows, body.to ?? "checking");
  if (!to.account_number_id) throw new Error("That account has no account number to receive into");

  // Column's documented shape: POST /simulate/receive-wire with
  // { destination_account_number_id, amount, currency_code }.
  const t = await column<any>("/simulate/receive-wire", {
    method: "POST",
    body: {
      destination_account_number_id: to.account_number_id,
      amount,
      currency_code: "USD",
    },
  });
  return { transferId: t?.id ?? null, status: t?.status ?? "submitted", amount };
}


// ---------------------------------------------------------------------------
// Admin / cleanup utilities
// ---------------------------------------------------------------------------
/**
 * Every resource is fully paginated: the wipe/delete tooling is only correct if
 * it can see the entire sandbox, not just the first 100 of each kind.
 */
async function adminList() {
  const fetchAll = (path: string, key: string) =>
    columnPaginated<any>(path, { key, max: 2000 })
      .then((items) => ({ items }))
      .catch((e: Error) => ({ items: [] as any[], error: String(e.message) }));

  const [entities, accounts, counterparties, webhooks] = await Promise.all([
    fetchAll("/entities", "entities"),
    fetchAll("/bank-accounts", "bank_accounts"),
    fetchAll("/counterparties", "counterparties"),
    fetchAll("/webhook-endpoints", "webhook_endpoints"),
  ]);
  return {
    entities: entities.items,
    bankAccounts: accounts.items,
    counterparties: counterparties.items,
    webhookEndpoints: webhooks.items,
    errors: {
      entities: (entities as any).error, bankAccounts: (accounts as any).error,
      counterparties: (counterparties as any).error, webhookEndpoints: (webhooks as any).error,
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
    // Activity feed load-more window for the mirrored transfer table.
    const page = { limit: Number(body?.limit) || undefined, offset: Number(body?.offset) || undefined };



    const isAdminAction = action.startsWith("admin_");

    // Rate limit per caller. Admin/mutating actions get a much tighter budget
    // than read-only status/sync polling.
    const isMutating = isAdminAction || ["provision", "transfer", "submit_evidence"].includes(action);
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
      case "test_webhook":
        return json(await testWebhook(user.id));
      case "provision":
        return json(await snapshot(user.id, { provision: true, limit: page.limit, offset: page.offset }));
      case "sync":
        return json(await snapshot(user.id, { provision: false, limit: page.limit, offset: page.offset }));
      case "transfer": {
        const result = await doTransfer(user.id, body);
        return json({ ...result, snapshot: await snapshot(user.id, { provision: false }) });
      }
      case "submit_evidence":
        return json(await submitEvidence(user.id, body));

      case "admin_list":
        return json(await adminList());
      case "admin_register_webhook":
        return json(await registerWebhook(Array.isArray(body.events) ? body.events : undefined));
      case "admin_simulate_ach_return":
        return json(await simulateAchReturn(user.id, body));
      case "admin_simulate_incoming_wire":
        return json(await simulateIncomingWire(user.id, body));

      // User-scoped: what the partner still needs from THIS caller. Never
      // accepts an entity id from the client — it resolves the caller's own.
      case "my_compliance": {
        const { data: mine } = await admin.from("column_entities")
          .select("entity_id, verification_status").eq("user_id", user.id).maybeSingle();
        if (!mine) return json({ entityId: null, verificationStatus: null, requirements: [] });
        const c = await entityCompliance(mine.entity_id);
        const reqs = (c?.requirements ?? c?.missing_fields ?? c?.details ?? []) as unknown;
        return json({
          entityId: mine.entity_id,
          verificationStatus: c?.verification_status ?? mine.verification_status,
          requirements: Array.isArray(reqs) ? reqs : [],
          raw: c,
        });
      }

      case "admin_compliance":
        return json(await entityCompliance(String(body.entityId ?? "")));
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
    const err = e as ColumnError;
    console.error("ledger-sync error", err.message, err.code ?? "");
    // Pass Column's structured error through so the UI can map known codes.
    return json({
      error: err.message,
      code: err.code ?? null,
      type: err.type ?? null,
      documentationUrl: err.documentationUrl ?? null,
    }, err.status && err.status < 500 ? 400 : 500);
  }
});


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

/**
 * Column's bank-account object carries a `status` string (`open`, `closed`,
 * `frozen`, …). It does NOT expose `is_closed` — reading that field always
 * produced `undefined`, so every account was mirrored as "open" even after it
 * was closed upstream. Read `status` and only fall back to the booleans.
 */
function accountStatus(acct: any): string {
  const s = String(acct?.status ?? "").trim().toLowerCase();
  if (s) return s;
  if (acct?.is_closed === true) return "closed";
  if (acct?.is_frozen === true) return "frozen";
  return "open";
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

  // `profiles` is the single source of truth for identity data — onboarding
  // collects it exactly once. The kyc row only ever refines the legal name.
  const profileName = String(profile?.preferred_name ?? "").trim().split(/\s+/);
  const first = kyc?.legal_first_name || profileName[0] || "Sandbox";
  const last = kyc?.legal_last_name || profileName.slice(1).join(" ") || "Tester";
  const email = profile?.email || undefined;

  // Column's person `income` is an ARRAY of numbers (whole dollars) so a range
  // can be expressed — a bare number is rejected. We collect a single figure
  // during onboarding, so we send a one-element array.
  const incomeDigits = String(profile?.annual_income ?? "").replace(/[^0-9]/g, "");
  const income = incomeDigits ? [Number(incomeDigits)] : undefined;

  // Column requires YYYY-MM-DD. Accept ISO or MM/DD/YYYY defensively.
  const toIsoDob = (v?: string | null): string => {
    const s = String(v ?? "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const m = /^(\d{2})[/-](\d{2})[/-](\d{4})$/.exec(s);
    if (m) return `${m[3]}-${m[1]}-${m[2]}`;
    return "1990-01-01";
  };


  // Sandbox entity. We deliberately do NOT forward a real SSN; the sandbox
  // accepts the documented test SSN and returns a verified person.
  // `pep_status` is required by Column's person payload; we do not ask the
  // customer a politically-exposed-person question yet, so "not_checked".
  const payload: Record<string, unknown> = {
    first_name: first,
    last_name: last,
    email,
    ssn: "123456789",
    date_of_birth: toIsoDob(
      (profile?.date_of_birth as string | undefined) ?? (kyc?.date_of_birth as string | undefined),
    ),

    pep_status: "not_checked",
    ...(income ? { income } : {}),
    ...(profile?.occupation ? { occupation: String(profile.occupation).slice(0, 64) } : {}),
    address: {
      line_1: profile?.address_street || kyc?.street || "1 Market St",
      city: profile?.address_city || kyc?.city || "San Francisco",
      state: profile?.address_region || kyc?.region || "CA",
      postal_code: profile?.address_postal_code || kyc?.postal_code || "94105",
      country_code: (profile?.country || kyc?.country || "US").toUpperCase(),
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
    // Column returns this UPPERCASE (VERIFIED / PENDING / MANUAL_REVIEW /
    // DENIED / UNVERIFIED). We normalise to lowercase on the way in so every
    // comparison in this app — and in the webhook handler — is case-stable.
    verification_status: normalizeVerification(created.verification_status),
    details: created,
  }).select().single();
  if (error) throw new Error(error.message);


  // Mirror the provider's verification verdict back onto the KYC record so the
  // app's gating reflects the real upstream decision.
  await syncKycStatus(userId, created.verification_status);
  return row;
}

/**
 * Column reports `verification_status` in UPPERCASE (`VERIFIED`, `PENDING`,
 * `MANUAL_REVIEW`, `DENIED`, `UNVERIFIED`). Everything we persist and compare
 * against is lowercase, so all ingest points funnel through here — a raw
 * uppercase value silently failing an `=== "verified"` check is exactly the
 * class of bug this prevents.
 */
export function normalizeVerification(raw: unknown): string {
  const v = String(raw ?? "").trim().toLowerCase();
  return v || "unverified";
}

/** Maps the provider verification verdict onto our own kyc_profiles status. */
async function syncKycStatus(userId: string, verification?: string) {
  const v = normalizeVerification(verification);

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
    status: accountStatus(acct),
    balances: acct.balances ?? {},
  }).select().single();
  if (error) throw new Error(error.message);
  // The creator is the PRIMARY owner. `account_owners` — not
  // `column_bank_accounts.user_id` — is the authority on who may touch an
  // account, so every new account must land there in the same breath.
  await admin.from("account_owners").upsert({
    bank_account_id: acct.id, user_id: userId, entity_id: entityId, role: "primary",
  }, { onConflict: "bank_account_id,user_id" });
  return row;
}

// ---------------------------------------------------------------------------
// Ownership resolution.
//
// Every read and every debit resolves accounts through `account_owners`, which
// carries both the account's creator (role "primary") and any accepted joint
// owner. Nothing in this file may fall back to `column_bank_accounts.user_id`
// alone — that column is only the creator, not the access list.
// ---------------------------------------------------------------------------
export interface OwnedAccount extends Record<string, any> {
  owner_role: "primary" | "joint";
}

async function ownedAccountRows(userId: string): Promise<OwnedAccount[]> {
  const { data: links } = await admin.from("account_owners")
    .select("bank_account_id, role").eq("user_id", userId);
  const ids = (links ?? []).map((l: any) => l.bank_account_id);
  if (!ids.length) return [];
  const roleBy = new Map((links ?? []).map((l: any) => [l.bank_account_id, l.role]));
  const { data } = await admin.from("column_bank_accounts")
    .select("*").in("bank_account_id", ids).order("created_at");
  return (data ?? []).map((r: any) => ({ ...r, owner_role: roleBy.get(r.bank_account_id) ?? "primary" }))
    // Own accounts first so a bare "checking" selector always means MY checking.
    .sort((a, b) => (a.owner_role === "primary" ? 0 : 1) - (b.owner_role === "primary" ? 0 : 1));
}

/** Owner roster for a set of accounts, with display names for the UI. */
async function ownersFor(bankAccountIds: string[]) {
  if (!bankAccountIds.length) return new Map<string, any[]>();
  const { data: links } = await admin.from("account_owners")
    .select("bank_account_id, user_id, role").in("bank_account_id", bankAccountIds);
  const userIds = [...new Set((links ?? []).map((l: any) => l.user_id))];
  const { data: profs } = userIds.length
    ? await admin.from("profiles").select("user_id, preferred_name, email").in("user_id", userIds)
    : { data: [] as any[] };
  const profBy = new Map((profs ?? []).map((p: any) => [p.user_id, p]));
  const out = new Map<string, any[]>();
  for (const l of links ?? []) {
    const p = profBy.get(l.user_id);
    const list = out.get(l.bank_account_id) ?? [];
    list.push({
      userId: l.user_id,
      role: l.role,
      name: p?.preferred_name || (p?.email ? String(p.email).split("@")[0] : "Owner"),
      email: p?.email ?? null,
    });
    out.set(l.bank_account_id, list);
  }
  return out;
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
  const rows = await ownedAccountRows(userId);
  const out: any[] = [];
  for (const r of rows) {
    try {
      const live = await column<any>(`/bank-accounts/${r.bank_account_id}`);
      await admin.from("column_bank_accounts").update({
        balances: live.balances ?? {},
        status: accountStatus(live),
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

  // Scoped by ACCOUNT, not by user: a joint account's history belongs to every
  // owner, so the watermark must consider rows first mirrored by a co-owner.
  const [{ data: newest }, { count: stalePending }] = await Promise.all([
    admin.from("column_transfers").select("occurred_at").in("bank_account_id", bankAccountIds)
      .order("occurred_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("column_transfers").select("transfer_id", { count: "exact", head: true })
      .in("bank_account_id", bankAccountIds).not("status", "in", '("completed","settled","posted","returned","canceled")'),
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
    .from("column_transfers").select("*", { count: "exact" }).in("bank_account_id", bankAccountIds)
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
  const [{ rows: transfers, hasMore, total }, ownerMap] = await Promise.all([
    syncTransfers(userId, ids, { limit: opts.limit, offset: opts.offset }),
    ownersFor(ids),
  ]);

  return {
    provisioned: true,
    transactionsHasMore: hasMore,
    transactionsTotal: total,
    transactionsOffset: Math.max(Number(opts.offset) || 0, 0),
    entity: {
      entityId: entity.entity_id,
      verificationStatus: entity.verification_status,
    },
    accounts: accounts.map((a) => {
      const owners = ownerMap.get(a.bank_account_id) ?? [];
      return {
        id: a.bank_account_id,
        name: a.description ?? "Everyday Checking",
        type: a.account_type ?? "checking",
        accountNumber: a.account_number_masked ?? "••••0000",
        routingNumber: a.routing_number ?? "",
        status: a.status === "open" ? "Active" : "Closed",
        isOverdrawn: a.is_overdrawn ?? false,
        isJoint: owners.length > 1,
        myRole: (a as any).owner_role ?? "primary",
        owners: owners.map((o) => ({ userId: o.userId, name: o.name, role: o.role, isMe: o.userId === userId })),
        ...mapBalances(a),
      };
    }),

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
  const rows = await ownedAccountRows(userId);
  if (!rows.length) throw new Error("No account yet — finish verification first");
  return rows;
}


/**
 * Resolve a source/destination account STRICTLY within the caller's own rows.
 *
 * `rows` is already scoped to the authenticated user, and an unrecognised
 * selector now throws instead of silently falling back to the first account —
 * a tampered `from`/`to` must fail loudly, never quietly debit something else.
 */
function pickAccount(rows: any[], which?: string) {
  if (!which) return rows[0];
  const match = rows.find((r) => r.account_type === which)
    ?? rows.find((r) => r.bank_account_id === which);
  if (!match) throw new Error("That account isn't one of yours");
  return match;
}

/**
 * A counterparty id supplied by the client is only usable if the caller
 * created it. Without this check, a tampered request body could wire money to
 * another user's saved recipient.
 */
async function assertOwnCounterparty(userId: string, counterpartyId: string) {
  const { data } = await admin.from("column_counterparties")
    .select("counterparty_id").eq("user_id", userId)
    .eq("counterparty_id", counterpartyId).maybeSingle();
  if (!data) throw new Error("Unknown recipient — add the account details again");
  return counterpartyId;
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

// ---------------------------------------------------------------------------
// AUTHORITATIVE transfer limits.
//
// The mirror of `src/lib/txPolicy.ts`, but this copy is the one that counts:
// it runs server-side, before Column is called, and computes usage from our
// own `column_transfers` history rather than from anything the client sends.
// A direct API call that skips the UI hits exactly the same wall.
// ---------------------------------------------------------------------------
type LimitKind = "book" | "ach" | "ach_pull" | "wire";

interface ServerLimit {
  key: string;
  label: string;
  /** Cap in cents. */
  perTxn?: number;
  rolling?: number;
  window: "daily" | "monthly";
}

const SERVER_LIMITS: Record<LimitKind, ServerLimit | null> = {
  // Money never leaves the customer at the bank on a book transfer, so there
  // is no regulatory cap — only a sanity ceiling against fat-finger errors.
  book: { key: "daily_internal", label: "daily transfer between your accounts", rolling: 250_000_00, window: "daily" },
  ach: { key: "daily_ach", label: "daily ACH transfer limit", perTxn: 25_000_00, rolling: 25_000_00, window: "daily" },
  wire: { key: "daily_wire", label: "daily wire transfer limit", perTxn: 100_000_00, rolling: 100_000_00, window: "daily" },
  ach_pull: { key: "monthly_deposit", label: "monthly deposit limit", perTxn: 25_000_00, rolling: 25_000_00, window: "monthly" },
};

/** Start of today / this month in US Eastern, expressed as a UTC instant. */
function windowStart(window: "daily" | "monthly") {
  const now = new Date();
  const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const offsetMs = now.getTime() - et.getTime();
  const local = window === "daily"
    ? new Date(et.getFullYear(), et.getMonth(), et.getDate())
    : new Date(et.getFullYear(), et.getMonth(), 1);
  return new Date(local.getTime() + offsetMs).toISOString();
}

/** Cents already used against a limit, from real settled + pending history. */
async function usedCents(userId: string, kind: LimitKind, limit: ServerLimit) {
  // Book legs are mirrored twice (in + out); count only the debit leg.
  const direction = kind === "ach_pull" ? "credit" : "debit";
  const type = kind === "book" ? "book" : kind === "wire" ? "wire" : "ach";
  const { data } = await admin.from("column_transfers")
    .select("amount_cents")
    .eq("user_id", userId)
    .eq("transfer_type", type)
    .eq("direction", direction)
    .gte("occurred_at", windowStart(limit.window))
    // A returned / cancelled / rejected transfer never moved money, so it must
    // not eat into the customer's allowance.
    .not("status", "in", '("returned","canceled","cancelled","rejected","failed")');
  return (data ?? []).reduce((sum: number, r: any) => sum + Number(r.amount_cents ?? 0), 0);
}

const usd = (c: number) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

class LimitError extends Error {
  code = "transfer_limit_exceeded";
  /** 400, not 500 — this is a rejected request, not a server fault. */
  status = 400;
}

/**
 * Throws when the requested amount would breach a per-transaction or rolling
 * limit. Called on EVERY transfer path, before any provider call.
 */
async function assertWithinLimits(userId: string, kind: LimitKind, amountCents: number) {
  const limit = SERVER_LIMITS[kind];
  if (!limit) return;
  if (limit.perTxn && amountCents > limit.perTxn) {
    throw new LimitError(`This transfer is over the ${limit.label} of ${usd(limit.perTxn)} per transfer.`);
  }
  if (!limit.rolling) return;
  const used = await usedCents(userId, kind, limit);
  if (used + amountCents > limit.rolling) {
    const left = Math.max(0, limit.rolling - used);
    throw new LimitError(
      `This would exceed your ${limit.label} of ${usd(limit.rolling)}. ` +
      `You have ${usd(left)} left in this ${limit.window === "daily" ? "day" : "month"}.`,
    );
  }
}

async function doTransfer(userId: string, body: any) {
  const rows = await accountsFor(userId);
  const kind = String(body.kind ?? "book");
  const amount = toCents(body.amount);
  const description = String(body.description ?? "Transfer").slice(0, 120);
  const requestId = typeof body.requestId === "string" ? body.requestId.slice(0, 64) : undefined;

  // Server-side gate. The UI checks limits too, but this is the check that
  // actually protects the bank — it cannot be skipped by calling the API directly.
  await assertWithinLimits(userId, kind as LimitKind, amount);



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
      ? await assertOwnCounterparty(userId, String(body.counterpartyId))
      : await ensureCounterparty(userId, {
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
        // `description` is our own 255-char reference. The 10-character field
        // the RECEIVER sees on their statement is `company_entry_description`
        // — truncating `description` to 10 was throwing away the real memo.
        description: description || "Transfer",
        company_entry_description:
          (description.toUpperCase().replace(/[^A-Z0-9 ]/g, "").trim().slice(0, 10) || "PAYMENT"),

      },
      idempotencyKey: await transferKey(userId, kind, amount, counterpartyId, requestId),
    });
    await recordTransfer(userId, "ach", from.bank_account_id, t, type === "DEBIT" ? "credit" : "debit", description);
    return { transferId: t.id, status: t.status };
  }

  if (kind === "wire") {
    const from = pickAccount(rows, body.from ?? "checking");
    const counterpartyId = body.counterpartyId
      ? await assertOwnCounterparty(userId, String(body.counterpartyId))
      : await ensureCounterparty(userId, {
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
 * Column's `document_type` and `purposes` are FIXED ENUMS — an arbitrary
 * string ("selfie", "drivers_license") is rejected by the API, which is how a
 * document upload can silently fail. We validate here, and map the few
 * app-side labels that don't line up onto the real enum member.
 */
const DOCUMENT_TYPES = new Set([
  "identity_license", "identity_passport", "identity_utility",
  "bank_statement", "bank_transaction_report", "bank_summary_report",
  "dda_agreement", "w9", "irs_letter", "check_attachment",
  "monthly_statement", "daily_statement", "bank_interest_report",
  "daily_loan_tape", "daily_originations_activity", "daily_transaction_activity",
  "receivable_purchases", "monthly_applications", "monthly_loan_reporting",
  "network_settlement_file", "screenshot", "loan_daily_summary", "1099_int",
  "certificate_of_business_formation", "company_bylaws_or_agreements",
  "certificate_of_good_standing", "active_status_certificate",
  "ownership_structure", "ein_confirmation",
  "business_license_or_permit", "source_of_funds_document",
  "source_of_wealth_document", "complete_customer_file", "other",
]);


/** App label → Column enum. Anything already valid passes through untouched. */
const DOCUMENT_TYPE_ALIASES: Record<string, string> = {
  selfie: "other",
  drivers_license: "identity_license",
  license: "identity_license",
  passport: "identity_passport",
  id_card: "identity_license",
  utility_bill: "identity_utility",
  proof_of_address: "identity_utility",
};

const EVIDENCE_PURPOSES = new Set([
  "proof_of_address", "business_formation", "identity_verification",
  "tax_id_confirmation", "active_status_certificate", "signed_account_agreement",
  "cardholder_agreement", "attestation_control_person",
  "attestation_beneficial_ownership", "attestation_account_info_truth",
  "attestation_terms_of_service", "ofac_screening", "adverse_media_screening",
  "pep_screening", "complete_customer_file", "irs_form_ss4", "irs_form_990",
  "nonprofit_other_evidence", "edd", "attestation_privacy_policy",
]);

function resolveDocumentType(raw: unknown): string {
  const v = String(raw ?? "").trim().toLowerCase();
  const mapped = DOCUMENT_TYPE_ALIASES[v] ?? v;
  if (!DOCUMENT_TYPES.has(mapped)) {
    throw new Error(`Unsupported document type "${v}"`);
  }
  return mapped;
}

function resolvePurposes(raw: unknown): string[] {
  const list = (Array.isArray(raw) ? raw : [raw])
    .map((p) => String(p ?? "").trim().toLowerCase())
    .filter(Boolean);
  const out = list.filter((p) => EVIDENCE_PURPOSES.has(p));
  const bad = list.filter((p) => !EVIDENCE_PURPOSES.has(p));
  if (bad.length) throw new Error(`Unsupported evidence purpose "${bad[0]}"`);
  return out.length ? out : ["identity_verification"];
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

  const documentType = resolveDocumentType(body.documentType ?? "identity_license");
  const purposes = resolvePurposes(body.purposes ?? body.purpose);
  const ext = mime.includes("png") ? "png" : mime.includes("pdf") ? "pdf" : "jpg";

  const form = new FormData();
  form.append("file", new Blob([bytes], { type: mime }), `${documentType}.${ext}`);
  form.append("evidence_type", "file");
  // Multipart form fields are strings, so Column takes the purposes as ONE
  // comma-separated value (the JSON endpoint is the one that takes an array).
  // Repeating the field produced a single record for the last value only.
  form.append("purposes", purposes.join(","));
  form.append("document_type", documentType);

  // The real endpoint is `/entities/{id}/evidence` — `/documents` under an
  // entity does not exist, so every upload was failing upstream.
  const res = await column<any>(`/entities/${entity.entity_id}/evidence`, {
    method: "POST",
    form,
    idempotencyKey: `evidence-${userId}-${documentType}-${bytes.byteLength}`,
  });
  const first = Array.isArray(res?.evidence) ? res.evidence[0] : null;
  return {
    documentId: first?.data?.document?.id ?? first?.id ?? res?.id ?? null,
    entityId: entity.entity_id,
    status: res?.status ?? "submitted",
  };

}

/**
 * Compliance view: exactly which required fields Column is still waiting on.
 *
 * Column reports FOUR per-field statuses — `complete`, `missing`, `invalid`
 * and `pending` — so we normalise the (variably-shaped) response into a flat
 * list the UI can render without re-deriving the semantics.
 */
export interface ComplianceItem {
  field: string;
  status: "complete" | "missing" | "invalid" | "pending" | "unknown";
  message?: string;
}

const FIELD_STATUSES = ["complete", "missing", "invalid", "pending"] as const;

function normalizeCompliance(raw: any): ComplianceItem[] {
  const out: ComplianceItem[] = [];
  const push = (field: unknown, status: unknown, message?: unknown) => {
    const s = String(status ?? "").trim().toLowerCase();
    out.push({
      field: String(field ?? "").trim() || "requirement",
      status: (FIELD_STATUSES as readonly string[]).includes(s) ? (s as ComplianceItem["status"]) : "unknown",
      message: message ? String(message) : undefined,
    });
  };

  const source = raw?.requirements ?? raw?.fields ?? raw?.missing_fields ?? raw?.details ?? raw;
  if (Array.isArray(source)) {
    for (const r of source) {
      if (typeof r === "string") push(r, "missing");
      else push(r?.field ?? r?.name ?? r?.requirement, r?.status ?? r?.state, r?.description ?? r?.message);
    }
  } else if (source && typeof source === "object") {
    for (const [field, val] of Object.entries(source)) {
      if (typeof val === "string") push(field, val);
      else if (val && typeof val === "object") {
        push(field, (val as any).status ?? (val as any).state, (val as any).description ?? (val as any).message);
      }
    }
  }
  return out;
}

async function entityCompliance(entityId: string) {
  if (!/^[A-Za-z0-9_\-]+$/.test(entityId)) throw new Error("Invalid entity id");
  const raw = await column<any>(`/entities/${entityId}/compliance`);
  return { ...raw, items: normalizeCompliance(raw) };
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
  // Reference only: Column scopes every request by the API key itself, so no
  // request in this file ever sends a platform_id. This is surfaced purely so
  // it can be quoted in a Column support conversation.
  out.platformId =
    Deno.env.get("COLUMN_PLATFORM_ID") ??
    (await column<any>("/platform").then((p) => p?.id ?? p?.platform_id ?? null).catch(() => null));
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

/**
 * Sweeps a sandbox bank account to a $0 balance so it can be deleted.
 *
 * Column refuses to delete an account holding funds, and refuses to delete an
 * entity that still owns accounts — so the wipe has to run
 * drain → delete accounts → delete entity, in that order. We push the residual
 * balance out over ACH to an external sandbox counterparty and force
 * settlement, because an unsettled transfer still counts against the balance.
 */
async function drainAccount(acct: any): Promise<{ drained: boolean; note?: string }> {
  const bal = mapBalances(acct);
  const cents = Math.round((bal.available ?? 0) * 100);
  if (cents <= 0) return { drained: true };
  try {
    const cp = await column<any>("/counterparties", {
      method: "POST",
      body: { routing_number: "021000021", account_number: "9999999999", name: "SANDBOX SWEEP" },
      idempotencyKey: `wipe-sweep-counterparty`,
    });
    const t = await column<any>("/transfers/ach", {
      method: "POST",
      body: {
        bank_account_id: acct.id,
        counterparty_id: cp.id,
        type: "CREDIT",
        amount: cents,
        currency_code: "USD",
        entry_class_code: "PPD",
        description: "SWEEP",
      },
      idempotencyKey: `wipe-sweep-${acct.id}-${cents}`,
    });
    await column("/simulate/transfers/ach/settle", {
      method: "POST", body: { ach_transfer_id: t.id },
    }).catch(() => {});
    return { drained: true, note: `swept ${(cents / 100).toFixed(2)} out` };
  } catch (e) {
    return { drained: false, note: `could not sweep balance: ${(e as Error).message}` };
  }
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

  // 1. Counterparties have no dependants — safe to clear first.
  await run("counterparty", listed.counterparties);

  // 2. Accounts must be at $0 before Column will delete them.
  for (const acct of listed.bankAccounts ?? []) {
    if (!acct?.id) continue;
    const { drained, note } = await drainAccount(acct);
    if (!drained) {
      results.push({ resource: "bank-account", id: acct.id, ok: false, error: note });
      continue;
    }
    try {
      await adminDelete("bank-account", acct.id);
      results.push({ resource: "bank-account", id: acct.id, ok: true, note });
    } catch (e) {
      results.push({ resource: "bank-account", id: acct.id, ok: false, error: (e as Error).message, note });
    }
  }

  // 3. Only now can the entities go — an entity with a surviving account is
  //    rejected, so we skip those instead of firing a call we know will fail.
  const survivingByEntity = new Set(
    results.filter((r) => r.resource === "bank-account" && !r.ok)
      .map((r) => (listed.bankAccounts ?? []).find((a: any) => a.id === r.id)?.entity_id)
      .filter(Boolean),
  );
  for (const ent of listed.entities ?? []) {
    if (!ent?.id) continue;
    if (survivingByEntity.has(ent.id)) {
      results.push({
        resource: "entity", id: ent.id, ok: false,
        error: "skipped: still owns an account that could not be emptied",
      });
      continue;
    }
    try { await adminDelete("entity", ent.id); results.push({ resource: "entity", id: ent.id, ok: true }); }
    catch (e) { results.push({ resource: "entity", id: ent.id, ok: false, error: (e as Error).message }); }
  }

  if (opts.includeWebhooks) await run("webhook-endpoint", listed.webhookEndpoints);

  // Local mirror
  await admin.from("column_transfers").delete().neq("transfer_id", "");
  await admin.from("column_bank_accounts").delete().neq("bank_account_id", "");
  await admin.from("column_entities").delete().neq("entity_id", "");
  return { wiped: results.length, results };
}

// ---------------------------------------------------------------------------
// Webhook endpoint management, delivery inspection and event reconciliation.
//
// Column's list/verify/delivery paths are documented with both hyphens and
// underscores depending on the page, so every call tries both spellings and
// keeps whichever answers.
// ---------------------------------------------------------------------------
async function columnAny<T = any>(paths: string[], init: Parameters<typeof column>[1] = {}): Promise<T> {
  let last: unknown;
  for (const p of paths) {
    try { return await column<T>(p, init); }
    catch (e) {
      last = e;
      if ((e as ColumnError).status !== 404) throw e;
    }
  }
  throw last;
}

const WEBHOOK_LIST_PATHS = ["/webhook-endpoints", "/webhook_endpoints"];

async function listWebhookEndpoints() {
  const res = await columnAny<any>(WEBHOOK_LIST_PATHS, { query: { limit: 100 } });
  const items = pickList(res, "webhook_endpoints");
  return items.map((h: any) => ({
    id: h.id,
    url: h.url,
    description: h.description ?? null,
    enabledEvents: h.enabled_events ?? [],
    isDisabled: h.is_disabled ?? h.disabled ?? false,
    createdAt: h.created_at ?? null,
  }));
}

/**
 * Asks Column to make a REAL delivery attempt to the endpoint with a synthetic
 * event of the given type, and returns whatever it reports about that attempt.
 * This is the definitive answer to "is Column even trying to reach us?".
 */
async function verifyWebhookEndpoint(id: string, eventType: string) {
  if (!/^[A-Za-z0-9_\-]+$/.test(id)) throw new Error("Invalid endpoint id");
  const type = String(eventType || "ach.outgoing_transfer.initiated");
  // The body takes `event_type` and NOTHING else — sending a second alias
  // field makes Column reject the whole call with `invalid_field_value`.
  const res = await columnAny<any>(
    [`/webhook-endpoints/${id}/verify`, `/webhook_endpoints/${id}/verify`],
    { method: "POST", body: { event_type: type } },
  );
  return {
    endpointId: id,
    eventType: type,
    statusCode: res?.response_status_code ?? res?.status_code ?? null,
    responseBody: res?.response_body ?? res?.body ?? null,
    success: res?.success ?? res?.is_success
      ?? (typeof res?.status === "string" ? res.status.toUpperCase() === "SUCCEEDED" : null),
    raw: res,
  };
}

async function webhookDeliveries(id: string, limit = 25) {
  if (!/^[A-Za-z0-9_\-]+$/.test(id)) throw new Error("Invalid endpoint id");
  const res = await columnAny<any>(
    [`/webhook-deliveries/endpoint/${id}`, `/webhook_deliveries/endpoint/${id}`],
    { query: { limit: Math.min(Math.max(limit, 1), 100) } },
  );
  const items = pickList(res, "webhook_deliveries");
  // A delivery is `{ event, scheduled_at, status }` — the outcome lives in
  // `status` (SUCCEEDED / FAILED / PENDING), not in an HTTP status code.
  return items.map((d: any, i: number) => {
    const status = typeof d?.status === "string" ? d.status.toUpperCase() : null;
    return {
      id: String(d?.id ?? d?.event?.id ?? `${id}-${i}`),
      eventId: d?.event_id ?? d?.event?.id ?? null,
      eventType: d?.event_type ?? d?.event?.type ?? null,
      status,
      scheduledAt: d?.scheduled_at ?? null,
      statusCode: d?.response_status_code ?? d?.status_code ?? null,
      success: status ? status === "SUCCEEDED" : (d?.is_success ?? d?.success ?? null),
      attempts: d?.attempt_count ?? d?.attempts ?? null,
      error: d?.error_message ?? d?.error ?? null,
      createdAt: d?.created_at ?? d?.scheduled_at ?? d?.event?.created_at ?? null,
      responseBody: typeof d?.response_body === "string" ? d.response_body.slice(0, 500) : null,
    };
  });
}


/**
 * Reconciliation: walks Column's own record of webhook events and flags any
 * that never landed in our `webhook_events` table — i.e. deliveries Column
 * eventually gave up retrying. Read-only; it reports, it doesn't replay.
 */
async function reconcileEvents(limit = 200) {
  const remote = await columnAny<any[]>(["/events/webhook"], {}).then(
    (r: any) => pickList(r, "events"),
  ).catch(async () => await columnPaginated<any>("/events/webhook", { key: "events", max: limit }));

  const capped = (remote as any[]).slice(0, limit);
  const ids = capped.map((e) => String(e?.id ?? "")).filter(Boolean);
  const seen = new Set<string>();
  if (ids.length) {
    const { data } = await admin.from("webhook_events")
      .select("event_id").eq("provider", "column").in("event_id", ids);
    for (const r of data ?? []) seen.add(String(r.event_id));
  }
  const missing = capped
    .filter((e) => e?.id && !seen.has(String(e.id)))
    .map((e) => ({
      id: e.id,
      type: e.type ?? null,
      createdAt: e.created_at ?? null,
    }));

  return {
    checked: capped.length,
    recorded: capped.length - missing.length,
    missingCount: missing.length,
    missing: missing.slice(0, 50),
  };
}


// ---------------------------------------------------------------------------
// Joint accounts.
//
// Backed by Column's real ownership model: `POST /bank-accounts/{id}/owner`
// with an `entity_id` adds a second verified entity as an owner of the same
// account. Our `account_owners` table mirrors that so RLS grants both humans
// access. Nothing here can be triggered unilaterally — an owner is only added
// after the invitee explicitly accepts a request addressed to them.
// ---------------------------------------------------------------------------

/** Throws unless the caller is the PRIMARY owner of the account. */
async function assertPrimaryOwner(userId: string, bankAccountId: string) {
  const { data } = await admin.from("account_owners")
    .select("role").eq("user_id", userId).eq("bank_account_id", bankAccountId).maybeSingle();
  if (!data) throw new Error("That account isn't one of yours");
  if (data.role !== "primary") throw new Error("Only the primary owner can manage joint owners");
}

async function verifiedEntityFor(userId: string) {
  const { data } = await admin.from("column_entities")
    .select("entity_id, verification_status").eq("user_id", userId).maybeSingle();
  if (!data?.entity_id) return null;
  const ok = String(data.verification_status ?? "").toLowerCase();
  return ok === "verified" || ok === "approved" ? data.entity_id as string : null;
}

async function jointList(userId: string) {
  const mine = await ownedAccountRows(userId);
  const ids = mine.map((a) => a.bank_account_id);
  const [{ data: incoming }, { data: outgoing }] = await Promise.all([
    admin.from("joint_owner_requests").select("*").eq("invitee_user_id", userId).eq("status", "pending"),
    ids.length
      ? admin.from("joint_owner_requests").select("*").in("bank_account_id", ids).eq("requester_user_id", userId)
        .order("created_at", { ascending: false }).limit(50)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const userIds = [...new Set([...(incoming ?? []), ...(outgoing ?? [])]
    .flatMap((r: any) => [r.requester_user_id, r.invitee_user_id]))];
  const { data: profs } = userIds.length
    ? await admin.from("profiles").select("user_id, preferred_name, email").in("user_id", userIds)
    : { data: [] as any[] };
  const nameOf = (id: string) => {
    const p = (profs ?? []).find((x: any) => x.user_id === id);
    return p?.preferred_name || (p?.email ? String(p.email).split("@")[0] : "Customer");
  };
  const accountName = (id: string) =>
    mine.find((a) => a.bank_account_id === id)?.description ?? "Account";

  const owners = await ownersFor(ids);
  return {
    incoming: (incoming ?? []).map((r: any) => ({
      id: r.id, bankAccountId: r.bank_account_id, from: nameOf(r.requester_user_id),
      createdAt: r.created_at,
    })),
    outgoing: (outgoing ?? []).map((r: any) => ({
      id: r.id, bankAccountId: r.bank_account_id, accountName: accountName(r.bank_account_id),
      to: nameOf(r.invitee_user_id), status: r.status, createdAt: r.created_at,
    })),
    accounts: mine.map((a) => ({
      id: a.bank_account_id,
      name: a.description ?? "Account",
      type: a.account_type,
      myRole: a.owner_role,
      owners: (owners.get(a.bank_account_id) ?? []).map((o) => ({
        userId: o.userId, name: o.name, role: o.role, isMe: o.userId === userId,
      })),
    })),
  };
}

async function jointRequest(userId: string, body: any) {
  const bankAccountId = String(body?.bankAccountId ?? "");
  const email = String(body?.email ?? "").trim().toLowerCase();
  if (!bankAccountId) throw new Error("Choose an account");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Enter a valid email address");
  await assertPrimaryOwner(userId, bankAccountId);

  // Deliberately opaque from here on: this endpoint must never become a way to
  // discover whether an email belongs to a customer. Every non-actionable
  // outcome returns the SAME response as a successful send.
  const opaque = {
    sent: true,
    message: `If ${email} belongs to a verified Glass Bank customer, the request is now waiting in their app for approval.`,
  };

  const { data: prof } = await admin.from("profiles")
    .select("user_id, email").ilike("email", email).maybeSingle();
  const inviteeId = prof?.user_id as string | undefined;
  if (!inviteeId || inviteeId === userId) return opaque;
  if (!(await verifiedEntityFor(inviteeId))) return opaque;

  const { data: already } = await admin.from("account_owners")
    .select("id").eq("bank_account_id", bankAccountId).eq("user_id", inviteeId).maybeSingle();
  if (already) return opaque;

  // A pending request is deduped by a PARTIAL unique index, which upsert can't
  // target — so check first and let the index be the backstop on a race.
  const { data: pending } = await admin.from("joint_owner_requests")
    .select("id").eq("bank_account_id", bankAccountId)
    .eq("invitee_user_id", inviteeId).eq("status", "pending").maybeSingle();
  if (pending) return opaque;

  const { error: insErr } = await admin.from("joint_owner_requests").insert({
    bank_account_id: bankAccountId,
    requester_user_id: userId,
    invitee_user_id: inviteeId,
    status: "pending",
  });
  if (insErr && !/duplicate key/i.test(insErr.message)) throw new Error(insErr.message);

  try {
    await admin.from("notifications").insert({
      user_id: inviteeId,
      title: "Joint account request",
      body: "Someone invited you to become a joint owner of their account.",
      type: "security",
    });
  } catch { /* notifications table is optional */ }

  return opaque;
}

async function jointRespond(userId: string, body: any) {
  const requestId = String(body?.requestId ?? "");
  const accept = !!body?.accept;
  // Scoped to the INVITEE: nobody can accept a request addressed to someone else.
  const { data: reqRow } = await admin.from("joint_owner_requests")
    .select("*").eq("id", requestId).eq("invitee_user_id", userId).eq("status", "pending").maybeSingle();
  if (!reqRow) throw new Error("That request is no longer available");

  if (!accept) {
    await admin.from("joint_owner_requests")
      .update({ status: "declined", responded_at: new Date().toISOString() }).eq("id", requestId);
    return { status: "declined" };
  }

  const entityId = await verifiedEntityFor(userId);
  if (!entityId) throw new Error("Finish your identity verification before joining an account");

  // Column is the source of truth for ownership — it must accept the new owner
  // before we grant anyone access on our side.
  await column<any>(`/bank-accounts/${reqRow.bank_account_id}/owner`, {
    method: "POST",
    body: { entity_id: entityId },
    idempotencyKey: `joint-${reqRow.id}`,
  });

  await admin.from("account_owners").upsert({
    bank_account_id: reqRow.bank_account_id,
    user_id: userId,
    entity_id: entityId,
    role: "joint",
  }, { onConflict: "bank_account_id,user_id" });

  await admin.from("joint_owner_requests")
    .update({ status: "accepted", responded_at: new Date().toISOString() }).eq("id", requestId);

  try {
    await admin.from("notifications").insert({
      user_id: reqRow.requester_user_id,
      title: "Joint owner added",
      body: "Your joint account request was accepted.",
      type: "security",
    });
  } catch { /* optional */ }

  return { status: "accepted", bankAccountId: reqRow.bank_account_id };
}

async function jointCancel(userId: string, body: any) {
  const requestId = String(body?.requestId ?? "");
  const { error } = await admin.from("joint_owner_requests")
    .update({ status: "canceled", responded_at: new Date().toISOString() })
    .eq("id", requestId).eq("requester_user_id", userId).eq("status", "pending");
  if (error) throw new Error(error.message);
  return { status: "canceled" };
}

async function jointRemove(userId: string, body: any) {
  const bankAccountId = String(body?.bankAccountId ?? "");
  const targetUserId = String(body?.userId ?? userId);
  const { data: target } = await admin.from("account_owners")
    .select("*").eq("bank_account_id", bankAccountId).eq("user_id", targetUserId).maybeSingle();
  if (!target) throw new Error("That person isn't an owner of this account");
  if (target.role === "primary") throw new Error("The primary owner can't be removed — close the account instead");
  // Either you're removing yourself (leaving), or you're the primary owner.
  if (targetUserId !== userId) await assertPrimaryOwner(userId, bankAccountId);

  // Column documents ADDING an owner; removal is not a documented public
  // endpoint, so we attempt it and report the outcome honestly rather than
  // pretending the upstream change happened.
  let providerRemoved = false;
  let providerNote: string | null = null;
  try {
    await column<any>(`/bank-accounts/${bankAccountId}/owner/${target.entity_id}`, { method: "DELETE" });
    providerRemoved = true;
  } catch (e) {
    providerNote = (e as Error).message;
  }

  await admin.from("account_owners").delete().eq("id", target.id);
  return { removed: true, providerRemoved, providerNote };
}

// ---------------------------------------------------------------------------
// Statements.
//
// Column generates a real monthly statement (PDF + CSV) for every open bank
// account and fires `reporting.bank_account_monthly_statement.completed` when
// it is ready. Those statements are settlement reports: the report object
// carries `pdf_document_id` / `csv_document_id`, and a document's `url` is a
// signed link that expires after 60 seconds — so we mint it on demand rather
// than storing it.
// ---------------------------------------------------------------------------

/** Mirrors one settlement-report object into `account_statements`. */
export async function upsertStatement(report: any, bankAccountId?: string) {
  const accountId = bankAccountId ?? report?.statement_subject_id ?? report?.bank_account_id;
  if (!accountId || !report?.id) return null;
  const { data } = await admin.from("account_statements").upsert({
    bank_account_id: String(accountId),
    report_id: String(report.id),
    statement_type: String(report.type ?? "bank_account_monthly_statement"),
    period_start: report.from_date ?? null,
    period_end: report.to_date ?? null,
    pdf_document_id: report.pdf_document_id || null,
    csv_document_id: report.csv_document_id || null,
    status: String(report.status ?? "completed").toLowerCase(),
    raw: report,
  }, { onConflict: "report_id" }).select().maybeSingle();
  return data;
}

/**
 * Backfills from the reporting API, then returns everything we hold for the
 * caller's accounts. Statements the partner has not produced yet simply do not
 * appear — we never invent one.
 */
async function listStatements(userId: string) {
  const rows = await ownedAccountRows(userId);
  const ids = rows.map((r) => r.bank_account_id);
  if (!ids.length) return { statements: [] };

  const nameBy = new Map(rows.map((r) => [r.bank_account_id, r.description || r.account_type]));

  for (const id of ids) {
    try {
      const reports = await columnPaginated<any>("/reporting", {
        key: "settlement_reports",
        max: 60,
        query: { statement_subject_id: id, type: "bank_account_monthly_statement" },
      });
      for (const r of reports) {
        if (String(r?.status ?? "").toLowerCase() !== "completed") continue;
        await upsertStatement(r, id);
      }
    } catch (e) {
      // Reporting access is a platform-level permission; a failure here must
      // not blank out statements we already mirrored.
      console.warn("statement backfill failed", id, (e as Error).message);
    }
  }

  const { data } = await admin.from("account_statements")
    .select("*").in("bank_account_id", ids).order("period_end", { ascending: false }).limit(200);

  return {
    statements: (data ?? []).map((s: any) => ({
      id: s.id,
      bankAccountId: s.bank_account_id,
      accountName: nameBy.get(s.bank_account_id) ?? "Account",
      periodStart: s.period_start,
      periodEnd: s.period_end,
      hasPdf: !!s.pdf_document_id,
      hasCsv: !!s.csv_document_id,
      status: s.status,
    })),
  };
}

/** Mints a short-lived download link for one of the caller's own statements. */
async function statementUrl(userId: string, body: any) {
  const statementId = String(body?.statementId ?? "");
  const format = String(body?.format ?? "pdf").toLowerCase() === "csv" ? "csv" : "pdf";
  const { data: row } = await admin.from("account_statements")
    .select("*").eq("id", statementId).maybeSingle();
  if (!row) throw new Error("Statement not found");

  // Ownership is resolved server-side against account_owners — the client's
  // claim about which account a statement belongs to is never trusted.
  const { data: owns } = await admin.from("account_owners")
    .select("id").eq("bank_account_id", row.bank_account_id).eq("user_id", userId).maybeSingle();
  if (!owns) throw new Error("That statement isn't one of yours");

  const documentId = format === "csv" ? row.csv_document_id : row.pdf_document_id;
  if (!documentId) throw new Error(`No ${format.toUpperCase()} available for this statement`);

  let url: string | null = null;
  try {
    const doc = await column<any>(`/documents/${documentId}`);
    url = doc?.url ?? null;
  } catch {
    const docs = await columnPaginated<any>("/documents", { key: "documents", max: 100 });
    url = docs.find((d: any) => d?.id === documentId)?.url ?? null;
  }
  if (!url) throw new Error("The statement download link has expired — try again");
  return { url, format, expiresInSeconds: 60 };
}

// ---------------------------------------------------------------------------



Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const bearer = authHeader.slice(7).trim();

    const body = await req.json().catch(() => ({}));

    // Service-to-service path: the scheduled-transfer executor runs a transfer
    // on a user's behalf. Only the service role may do this, and it may only
    // run "transfer" — never an admin action.
    if (bearer && bearer === SERVICE_KEY && typeof body?.onBehalfOf === "string") {
      if (String(body?.action ?? "") !== "transfer") {
        return json({ error: "Forbidden" }, 403);
      }
      const result = await doTransfer(body.onBehalfOf, body);
      return json(result);
    }
    // Anyone else asking to act "on behalf of" someone is rejected outright
    // rather than quietly downgraded to their own identity.
    if (body?.onBehalfOf !== undefined) return json({ error: "Forbidden" }, 403);



    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "Unauthorized" }, 401);


    const action = String(body?.action ?? "");
    // Activity feed load-more window for the mirrored transfer table.
    const page = { limit: Number(body?.limit) || undefined, offset: Number(body?.offset) || undefined };



    const isAdminAction = action.startsWith("admin_");

    // Rate limit per caller. Admin/mutating actions get a much tighter budget
    // than read-only status/sync polling.
    const isMutating = isAdminAction || ["provision", "transfer", "submit_evidence", "joint_request", "joint_respond", "joint_cancel", "joint_remove"].includes(action);
    const rl = rateLimit(`ledger:${user.id}:${isMutating ? "write" : "read"}`, isMutating ? 10 : 60);
    if (!rl.allowed) return tooManyRequests(rl.retryAfter, corsHeaders);

    if (isAdminAction) {
      const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!isAdmin) return json({ error: "Forbidden" }, 403);
    }

    switch (action) {
      case "joint_list":
        return json(await jointList(user.id));
      case "joint_request":
        return json(await jointRequest(user.id, body));
      case "joint_respond":
        return json(await jointRespond(user.id, body));
      case "joint_cancel":
        return json(await jointCancel(user.id, body));
      case "joint_remove":
        return json(await jointRemove(user.id, body));

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

      case "statements":
        return json(await listStatements(user.id));
      case "statement_url":
        return json(await statementUrl(user.id, body));



      case "admin_list":
        return json(await adminList());
      case "admin_register_webhook":
        return json(await registerWebhook(Array.isArray(body.events) ? body.events : undefined));
      case "admin_webhook_endpoints":
        return json({ endpoints: await listWebhookEndpoints() });
      case "admin_webhook_verify":
        return json(await verifyWebhookEndpoint(String(body.id ?? ""), String(body.eventType ?? "")));
      case "admin_webhook_deliveries":
        return json({ deliveries: await webhookDeliveries(String(body.id ?? ""), Number(body.limit) || 25) });
      case "admin_reconcile_events":
        return json(await reconcileEvents(Number(body.limit) || 200));
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
        return json({
          entityId: mine.entity_id,
          verificationStatus: normalizeVerification(c?.verification_status ?? mine.verification_status),
          // Normalised {field, status, message} carrying all four real field
          // statuses — the UI needs to tell "invalid" apart from "missing".
          requirements: c.items ?? [],
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


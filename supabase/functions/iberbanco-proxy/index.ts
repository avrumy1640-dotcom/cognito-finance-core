// Iberbanco API proxy — keeps agent credentials server-side and computes the
// per-request SHA-256 hash Iberbanco requires (token + timestamp + username).
//
// SECURITY: This function is authenticated. Every request must carry a valid
// Supabase Bearer token. The caller's Iberbanco `user_number` is resolved from
// their kyc_profiles row and forced into the request — the client cannot access
// another customer's user_number. Any `account_number*` values are validated
// against the caller's own Iberbanco accounts before the request is forwarded.
//
// Request body: {
//   path: "/accounts",            // Iberbanco path, must start with "/"
//   method?: "GET"|"POST"|"PATCH"|"DELETE",
//   body?: object,                // JSON body for POST/PATCH
//   query?: Record<string, string|number>
// }
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const DEFAULT_BASE = "https://api.iberbanco.dev/api/v2";
const BASE = Deno.env.get("IBERBANCO_BASE_URL") || DEFAULT_BASE;

// ---------- token cache (per warm instance) ----------
let cachedToken: string | null = null;
let cachedUsername: string | null = null;
let cachedExpiry = 0; // epoch ms

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function authenticate(): Promise<{ token: string; username: string }> {
  const username = Deno.env.get("IBERBANCO_AGENT_USERNAME") || "";
  const password = Deno.env.get("IBERBANCO_AGENT_PASSWORD") || "";
  if (!username || !password) {
    throw new Error("IBERBANCO_AGENT_USERNAME / IBERBANCO_AGENT_PASSWORD not configured");
  }
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
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* noop */ }
  if (!res.ok || !json?.data?.token) {
    throw new Error(`Iberbanco auth failed (${res.status}): ${json?.message ?? text}`);
  }
  cachedToken = String(json.data.token);
  cachedUsername = username;
  const exp = json.data.token_expire_at ? Date.parse(json.data.token_expire_at) : now + 30 * 60_000;
  cachedExpiry = Number.isFinite(exp) ? exp : now + 30 * 60_000;
  return { token: cachedToken, username: cachedUsername };
}

export async function iberbancoRequest(
  path: string,
  init: { method?: string; body?: unknown; query?: Record<string, unknown>; formData?: FormData } = {},
): Promise<{ status: number; payload: unknown }> {
  if (!path.startsWith("/")) throw new Error("path must start with '/'");
  const { token, username } = await authenticate();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const hash = await sha256Hex(token + timestamp + username);

  const url = new URL(BASE + path);
  if (init.query) {
    for (const [k, v] of Object.entries(init.query)) {
      if (v === undefined || v === null || v === "") continue;
      url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {
    token,
    timestamp,
    hash,
    Accept: "application/json",
  };

  let body: BodyInit | undefined;
  if (init.formData) {
    body = init.formData;
  } else if (init.body !== undefined && init.method !== "GET" && init.method !== "DELETE") {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.body);
  }

  const res = await fetch(url.toString(), {
    method: init.method || "GET",
    headers,
    body,
  });
  const text = await res.text();
  let payload: unknown;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = { raw: text }; }
  return { status: res.status, payload };
}

// ---- Ownership helpers -----------------------------------------------------

// Fields that carry an account_special_number belonging to (or referenced by)
// the caller. Any value seen here must be validated against the user's own
// Iberbanco accounts. Beneficiary account numbers on ACH/SWIFT/BILL payments
// are external destinations and are NOT validated here.
const ACCOUNT_FIELDS = new Set([
  "account_number",
  "account_special_number",
  "account_number_from",
  "account_number_to",
  "from_account",
  "to_account",
]);

// Cache the user's account list briefly per warm instance.
const accountsCache = new Map<string, { at: number; accounts: Set<string> }>();

async function fetchOwnedAccounts(user_number: string): Promise<Set<string>> {
  const cached = accountsCache.get(user_number);
  const now = Date.now();
  if (cached && now - cached.at < 30_000) return cached.accounts;
  const { status, payload } = await iberbancoRequest("/accounts", {
    method: "GET",
    query: { user_number, per_page: 100 },
  });
  if (status < 200 || status >= 300) {
    throw new Error(`Failed to list caller's accounts (${status})`);
  }
  const env = payload as { data?: unknown } | null;
  const list = Array.isArray(env?.data)
    ? env!.data as Array<{ account_special_number?: string }>
    : Array.isArray(payload) ? payload as Array<{ account_special_number?: string }> : [];
  const set = new Set<string>();
  for (const a of list) if (a?.account_special_number) set.add(String(a.account_special_number));
  accountsCache.set(user_number, { at: now, accounts: set });
  return set;
}

function collectAccountRefs(obj: unknown, out: string[] = []): string[] {
  if (!obj || typeof obj !== "object") return out;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (ACCOUNT_FIELDS.has(k) && (typeof v === "string" || typeof v === "number")) {
      const s = String(v).trim();
      if (s) out.push(s);
    } else if (v && typeof v === "object") {
      collectAccountRefs(v, out);
    }
  }
  return out;
}

function overrideUserNumber(obj: unknown, ownUserNumber: string): void {
  if (!obj || typeof obj !== "object") return;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (k === "user_number") (obj as Record<string, unknown>)[k] = ownUserNumber;
    else if (v && typeof v === "object") overrideUserNumber(v, ownUserNumber);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    // --- 1. Require an authenticated Supabase caller ---
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return json({ status: "error", message: "Unauthorized" }, 401);
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return json({ status: "error", message: "Unauthorized" }, 401);
    }
    const userId = userData.user.id;

    // --- 2. Parse + validate request shape ---
    const { path, method = "GET", body, query } = await req.json().catch(() => ({}));
    if (!path || typeof path !== "string" || !path.startsWith("/")) {
      return json({ status: "error", message: "path must start with '/'" }, 400);
    }
    const allowed = ["/accounts", "/transactions", "/cards", "/users", "/currencies", "/crypto", "/exchange", "/gateway"];
    if (!allowed.some((p) => path === p || path.startsWith(p + "/") || path.startsWith(p + "?"))) {
      return json({ status: "error", message: `Path not allowed: ${path}` }, 400);
    }

    // --- 3. Resolve caller's Iberbanco user_number server-side ---
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: kyc } = await admin
      .from("kyc_profiles")
      .select("iberbanco_user_number, status")
      .eq("user_id", userId)
      .maybeSingle();
    const ownUserNumber = (kyc as { iberbanco_user_number?: string | null } | null)?.iberbanco_user_number ?? null;

    // Only reference-data endpoints are usable before Iberbanco onboarding.
    const publicishPrefixes = ["/currencies", "/exchange"];
    const needsOwnership = !publicishPrefixes.some((p) => path === p || path.startsWith(p + "/"));
    if (needsOwnership && !ownUserNumber) {
      return json({ status: "error", message: "Iberbanco profile not provisioned for this user" }, 403);
    }

    // --- 4. Force user_number to the caller's own value everywhere ---
    const safeQuery: Record<string, unknown> = { ...(query ?? {}) };
    if (ownUserNumber && "user_number" in safeQuery) safeQuery.user_number = ownUserNumber;
    const safeBody = body && typeof body === "object" ? JSON.parse(JSON.stringify(body)) : body;
    if (ownUserNumber && safeBody && typeof safeBody === "object") {
      overrideUserNumber(safeBody, ownUserNumber);
    }

    // --- 5. Validate any account_number references belong to the caller ---
    if (ownUserNumber && needsOwnership) {
      const refs = [
        ...collectAccountRefs(safeQuery),
        ...collectAccountRefs(safeBody),
      ];
      if (refs.length > 0) {
        const owned = await fetchOwnedAccounts(ownUserNumber);
        for (const r of refs) {
          if (!owned.has(r)) {
            return json(
              { status: "error", message: "Account does not belong to the authenticated user" },
              403,
            );
          }
        }
      }
    }

    // --- 6. Forward to Iberbanco with sanitized values ---
    const { status, payload } = await iberbancoRequest(path, {
      method,
      body: safeBody,
      query: safeQuery,
    });
    return new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("iberbanco-proxy error", err);
    return json({ status: "error", message: err instanceof Error ? err.message : String(err) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

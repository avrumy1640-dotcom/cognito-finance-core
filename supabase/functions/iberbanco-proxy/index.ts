// Iberbanco API proxy — keeps agent credentials server-side and computes the
// per-request SHA-256 hash Iberbanco requires (token + timestamp + username).
//
// Request body: {
//   path: "/accounts",            // Iberbanco path, must start with "/"
//   method?: "GET"|"POST"|"PATCH"|"DELETE",
//   body?: object,                // JSON body for POST/PATCH
//   query?: Record<string, string|number>
// }
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { path, method = "GET", body, query } = await req.json().catch(() => ({}));
    if (!path || typeof path !== "string" || !path.startsWith("/")) {
      return json({ status: "error", message: "path must start with '/'" }, 400);
    }
    // Allowlist Iberbanco API paths only
    const allowed = ["/accounts", "/transactions", "/cards", "/users", "/currencies", "/crypto", "/exchange", "/gateway"];
    if (!allowed.some((p) => path === p || path.startsWith(p + "/") || path.startsWith(p + "?"))) {
      return json({ status: "error", message: `Path not allowed: ${path}` }, 400);
    }
    const { status, payload } = await iberbancoRequest(path, { method, body, query });
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

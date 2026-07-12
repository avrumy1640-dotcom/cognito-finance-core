// Column API proxy — keeps COLUMN_API_KEY server-side.
// POST body: { path: "/bank-accounts", method?: "GET"|"POST"|"PATCH"|"DELETE", body?: object, query?: Record<string,string> }
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const COLUMN_BASE = "https://api.column.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("COLUMN_API_KEY");
    if (!apiKey) {
      return json({ error: "COLUMN_API_KEY is not configured" }, 500);
    }

    const { path, method = "GET", body, query } = await req.json().catch(() => ({}));
    if (!path || typeof path !== "string" || !path.startsWith("/")) {
      return json({ error: "path must be a string starting with '/'" }, 400);
    }

    // Allowlist Column API paths only (defense-in-depth)
    const allowed = [
      "/entities",
      "/bank-accounts",
      "/transactions",
      "/transfers",
      "/counterparties",
      "/cards",
      "/loans",
      "/wires",
      "/ach",
      "/book-transfers",
      "/institutions",
      "/webhooks",
      "/reporting",
    ];
    if (!allowed.some((p) => path.startsWith(p))) {
      return json({ error: `Path not allowed: ${path}` }, 400);
    }

    const url = new URL(COLUMN_BASE + path);
    if (query && typeof query === "object") {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
      }
    }

    const auth = "Basic " + btoa(":" + apiKey);
    const upstream = await fetch(url.toString(), {
      method,
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: method === "GET" || method === "DELETE" ? undefined : JSON.stringify(body ?? {}),
    });

    const text = await upstream.text();
    let payload: unknown;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = { raw: text }; }

    if (!upstream.ok) {
      console.error(`Column API ${method} ${path} → ${upstream.status}`, text);
    }

    return new Response(JSON.stringify(payload), {
      status: upstream.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("column-proxy error", err);
    return json({ error: String(err instanceof Error ? err.message : err) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Iberbanco KYC — registers a personal user via /users/register/personal
// (multipart/form-data), stores the returned user_number on kyc_profiles, and
// resolves the caller's verification status.
//
// The client sends a JSON body; we translate it to multipart on Iberbanco's
// side. Files come in as data-URLs (base64) so JSON transport works.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const DEFAULT_BASE = "https://api.iberbanco.dev/api/v2";
const BASE = Deno.env.get("IBERBANCO_BASE_URL") || DEFAULT_BASE;

let cachedToken: string | null = null;
let cachedUsername: string | null = null;
let cachedExpiry = 0;

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function auth(): Promise<{ token: string; username: string }> {
  const username = Deno.env.get("IBERBANCO_AGENT_USERNAME") || "";
  const password = Deno.env.get("IBERBANCO_AGENT_PASSWORD") || "";
  if (!username || !password) throw new Error("IBERBANCO_AGENT_USERNAME / IBERBANCO_AGENT_PASSWORD not configured");
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
  let js: any = null;
  try { js = text ? JSON.parse(text) : null; } catch { /* noop */ }
  if (!res.ok || !js?.data?.token) throw new Error(`Iberbanco auth failed (${res.status}): ${js?.message ?? text}`);
  cachedToken = String(js.data.token);
  cachedUsername = username;
  const exp = js.data.token_expire_at ? Date.parse(js.data.token_expire_at) : now + 30 * 60_000;
  cachedExpiry = Number.isFinite(exp) ? exp : now + 30 * 60_000;
  return { token: cachedToken, username: cachedUsername };
}

function dataUrlToBlob(dataUrl: string): Blob {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!m) throw new Error("selfie must be a base64 data URL");
  const mime = m[1];
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

interface Body {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  call_number: string; // E.164
  date_of_birth: string; // YYYY-MM-DD
  address: string;
  city: string;
  state_or_province: string;
  post_code: string;
  country: string; // ISO alpha-2
  citizenship: string; // ISO alpha-2
  currencies: number[]; // e.g. [1]
  selected_service: string[]; // e.g. ["crypto","card","bank"]
  identity_card_type: 1 | 2 | 3;
  identity_card_id: string;
  identityIssuedDate: string;
  identityExpirationDate: string;
  employmentStatus: string;
  income: number | string;
  occupation: string;
  selfie: string; // data URL
  // KYC display fields we mirror into the DB
  ssn_last4?: string;
  id_type_label?: string;
  id_number_last4?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Missing auth" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes.user) return json({ error: "Not authenticated" }, 401);
    const user = userRes.user;

    const b = (await req.json().catch(() => null)) as Body | null;
    if (!b) return json({ error: "Invalid JSON body" }, 400);
    if (!b.selfie) return json({ error: "selfie is required" }, 400);

    // Build multipart body
    const fd = new FormData();
    const scalars: Record<string, string> = {
      email: b.email,
      password: b.password,
      first_name: b.first_name,
      last_name: b.last_name,
      call_number: b.call_number,
      date_of_birth: b.date_of_birth,
      address: b.address,
      city: b.city,
      state_or_province: b.state_or_province,
      post_code: b.post_code,
      country: (b.country || "US").toUpperCase(),
      citizenship: (b.citizenship || "US").toUpperCase(),
      identity_card_type: String(b.identity_card_type ?? 1),
      identity_card_id: b.identity_card_id,
      identityIssuedDate: b.identityIssuedDate,
      identityExpirationDate: b.identityExpirationDate,
      employmentStatus: b.employmentStatus,
      income: String(b.income),
      occupation: b.occupation,
    };
    for (const [k, v] of Object.entries(scalars)) fd.append(k, v);
    for (const c of b.currencies ?? [1]) fd.append("currencies[]", String(c));
    for (const s of b.selected_service ?? ["crypto", "card", "bank"]) fd.append("selected_service[]", s);
    fd.append("selfie", dataUrlToBlob(b.selfie), "selfie.jpg");

    const { token, username } = await auth();
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const hash = await sha256Hex(token + timestamp + username);

    const upstream = await fetch(`${BASE}/users/register/personal`, {
      method: "POST",
      headers: { token, timestamp, hash, Accept: "application/json" },
      body: fd,
    });
    const text = await upstream.text();
    let payload: any = null;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = { raw: text }; }

    const admin = createClient(supabaseUrl, serviceKey);

    if (!upstream.ok) {
      const reason =
        payload?.message ||
        (Array.isArray(payload?.errors) ? payload.errors.join("; ") : null) ||
        `Verification provider error (${upstream.status})`;
      await admin
        .from("kyc_profiles")
        .update({
          status: "rejected",
          rejection_reason: reason,
          reviewed_at: new Date().toISOString(),
          iberbanco_status_raw: String(upstream.status),
        })
        .eq("user_id", user.id);
      return json({ status: "rejected", reason, provider_status: upstream.status }, 200);
    }

    const data = payload?.data ?? payload;
    const user_number: string | null = data?.user_number ?? data?.user?.user_number ?? null;
    const rawStatus = String(data?.status ?? data?.user?.status ?? "pending").toLowerCase();

    let dbStatus: "verified" | "pending" | "rejected" = "pending";
    if (rawStatus.includes("approved") || rawStatus.includes("active")) dbStatus = "verified";
    else if (rawStatus.includes("denied") || rawStatus.includes("reject")) dbStatus = "rejected";

    const { error: updErr } = await admin
      .from("kyc_profiles")
      .update({
        status: dbStatus,
        iberbanco_user_number: user_number,
        iberbanco_status_raw: rawStatus,
        rejection_reason: dbStatus === "rejected" ? (data?.message ?? "Verification denied") : null,
        reviewed_at: dbStatus === "pending" ? null : new Date().toISOString(),
      })
      .eq("user_id", user.id);
    if (updErr) return json({ error: updErr.message }, 500);

    return json({ status: dbStatus, user_number, raw_status: rawStatus });
  } catch (err) {
    console.error("iberbanco-kyc error", err);
    return json({ error: String(err instanceof Error ? err.message : err) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// KYC verification via Column Person entity.
// Accepts full SSN + ID from client (transient), submits to Column, and
// updates kyc_profiles with a real verification outcome (verified / pending / rejected).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const COLUMN_BASE = "https://api.column.com";

type Body = {
  legal_first_name: string;
  legal_middle_name?: string;
  legal_last_name: string;
  date_of_birth: string; // YYYY-MM-DD
  ssn_full: string; // 9 digits (dashes stripped)
  id_type: "drivers_license" | "passport" | "state_id";
  id_number: string;
  street: string;
  city: string;
  region: string;
  postal_code: string;
  country: string; // "US"
  employment_status?: string;
  email?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("COLUMN_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    if (!apiKey) return json({ error: "COLUMN_API_KEY not configured" }, 500);

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Missing auth" }, 401);

    // Resolve caller
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes.user) return json({ error: "Not authenticated" }, 401);
    const user = userRes.user;

    const body = (await req.json().catch(() => null)) as Body | null;
    if (!body) return json({ error: "Invalid JSON body" }, 400);

    const ssnDigits = String(body.ssn_full ?? "").replace(/\D/g, "");
    if (ssnDigits.length !== 9) return json({ error: "SSN must be 9 digits" }, 400);

    const admin = createClient(supabaseUrl, serviceKey);

    // Submit to Column Persons endpoint.
    // Docs: POST /entities/person creates a person entity and runs identity verification.
    const personBody: Record<string, unknown> = {
      first_name: body.legal_first_name,
      middle_name: body.legal_middle_name ?? undefined,
      last_name: body.legal_last_name,
      date_of_birth: body.date_of_birth,
      ssn: ssnDigits,
      email_address: body.email ?? user.email ?? undefined,
      address: {
        line_1: body.street,
        city: body.city,
        state: body.region,
        postal_code: body.postal_code,
        country_code: body.country || "US",
      },
    };

    const upstream = await fetch(`${COLUMN_BASE}/entities/person`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(":" + apiKey),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(personBody),
    });

    const text = await upstream.text();
    let payload: any = null;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = { raw: text }; }

    if (!upstream.ok) {
      console.error("Column entities/person error", upstream.status, text);
      await admin
        .from("kyc_profiles")
        .update({
          status: "rejected",
          rejection_reason:
            payload?.message ?? `Verification provider error (${upstream.status})`,
          reviewed_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
      return json(
        { status: "rejected", reason: payload?.message ?? "Verification failed", provider_status: upstream.status },
        200,
      );
    }

    // Column returns something like:
    // { id, verification_status: "passed"|"pending_documents"|"manual_review"|"denied", verification_tags: [...] }
    const rawStatus: string = String(
      payload?.verification_status ?? payload?.person_details?.verification_status ?? "manual_review",
    ).toLowerCase();
    const tags: string[] = Array.isArray(payload?.verification_tags)
      ? payload.verification_tags
      : Array.isArray(payload?.person_details?.verification_tags)
      ? payload.person_details.verification_tags
      : [];

    let dbStatus: "verified" | "pending" | "rejected";
    let reason: string | null = null;
    if (rawStatus === "passed" || rawStatus === "approved" || rawStatus === "verified") {
      dbStatus = "verified";
    } else if (rawStatus === "denied" || rawStatus === "rejected" || rawStatus === "failed") {
      dbStatus = "rejected";
      reason = tags.length ? `Verification denied: ${tags.join(", ")}` : "Verification denied.";
    } else {
      dbStatus = "pending";
      reason = tags.length ? `Additional review required: ${tags.join(", ")}` : null;
    }

    const { error: updErr } = await admin
      .from("kyc_profiles")
      .update({
        status: dbStatus,
        rejection_reason: reason,
        column_person_id: payload?.id ?? null,
        verification_tags: tags,
        reviewed_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (updErr) {
      console.error("kyc update failed", updErr);
      return json({ error: updErr.message }, 500);
    }

    return json({
      status: dbStatus,
      reason,
      verification_tags: tags,
      column_person_id: payload?.id ?? null,
    });
  } catch (err) {
    console.error("kyc-verify error", err);
    return json({ error: String(err instanceof Error ? err.message : err) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

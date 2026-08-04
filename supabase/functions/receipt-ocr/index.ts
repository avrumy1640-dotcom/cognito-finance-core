// Receipt OCR.
//
// Takes a receipt the user just uploaded to the private `receipts` bucket and
// asks the AI gateway to read the merchant, date, total and a category out of
// it. The result is only ever a *suggestion*: the client shows it for
// confirmation and the user can edit or discard it before anything is written.
//
// The image never leaves the server unsigned — we mint a short-lived signed URL
// for the caller's own object and verify ownership through the caller's JWT
// before doing so, so one user can never OCR another user's receipt.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { rateLimit, tooManyRequests } from "../_shared/rateLimit.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const CATEGORIES = [
  "Groceries", "Dining", "Transport", "Bills & Utilities", "Housing",
  "Health", "Entertainment", "Travel", "Shopping", "Office & Software",
  "Professional Services", "Fees", "Transfers", "Income", "Other",
];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Missing bearer token" }, 401);

    const authed = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await authed.auth.getUser();
    const userId = userRes?.user?.id;
    if (!userId) return json({ error: "Invalid session" }, 401);

    // OCR is a paid model call — keep it modest per user.
    const rl = rateLimit(`receipt-ocr:${userId}`, 12);
    if (!rl.allowed) return tooManyRequests(rl.retryAfter, corsHeaders);

    const body = await req.json().catch(() => ({}));
    const path = String(body?.path ?? "");
    const contentType = String(body?.contentType ?? "image/jpeg");
    if (!path) return json({ error: "path is required" }, 400);

    // Storage layout is `<user_id>/<file>` — anything else is not the caller's.
    if (!path.startsWith(`${userId}/`)) return json({ error: "Not your receipt" }, 403);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: signed, error: signErr } = await admin.storage
      .from("receipts").createSignedUrl(path, 120);
    if (signErr || !signed?.signedUrl) return json({ error: "Receipt unavailable" }, 404);

    const isPdf = contentType.includes("pdf");
    const content = isPdf
      ? [
        { type: "text", text: PROMPT },
        { type: "file", file: { filename: path.split("/").pop(), file_data: signed.signedUrl } },
      ]
      : [
        { type: "text", text: PROMPT },
        { type: "image_url", image_url: { url: signed.signedUrl } },
      ];

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": LOVABLE_API_KEY,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-5.6-sol",
        reasoning_effort: "none",
        messages: [{ role: "user", content }],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "receipt",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                merchant: { type: ["string", "null"] },
                date: { type: ["string", "null"] },
                total: { type: ["number", "null"] },
                currency: { type: ["string", "null"] },
                category: { type: ["string", "null"], enum: [...CATEGORIES, null] },
                summary: { type: ["string", "null"] },
              },
              required: ["merchant", "date", "total", "currency", "category", "summary"],
            },
          },
        },
      }),
    });

    if (res.status === 429) return json({ error: "AI is busy right now. Try again shortly." }, 429);
    if (res.status === 402) return json({ error: "AI credits exhausted. Add credits to continue." }, 402);
    if (!res.ok) {
      const detail = await res.text();
      console.error("gateway error", res.status, detail);
      return json({ error: "Could not read that receipt" }, 502);
    }

    const payload = await res.json();
    const raw = payload?.choices?.[0]?.message?.content ?? "{}";
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }

    return json({ ok: true, suggestion: parsed });
  } catch (err) {
    console.error(err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

const PROMPT = `You are reading a purchase receipt or invoice for a business banking app.
Extract, as accurately as you can:
- merchant: the trading name of the seller, exactly as printed
- date: the transaction date in YYYY-MM-DD format
- total: the final grand total actually charged, as a plain number (not the subtotal, not the tax)
- currency: the 3-letter ISO currency code
- category: the single best fit from this list: ${CATEGORIES.join(", ")}
- summary: a short human description under 60 characters, e.g. "Office chairs — Herman Miller"
Use null for any field you cannot read with confidence. Never guess a total.`;

import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauth } from "../supabaseForUser";

export default defineTool({
  name: "create_payment_request",
  title: "Create payment request",
  description: "Create a new payment request (invoice) from the signed-in user to a payer.",
  inputSchema: {
    amount_cents: z.number().int().positive().describe("Amount in minor currency units (e.g. cents)."),
    currency: z.string().length(3).optional().describe("ISO currency code, defaults to USD."),
    payer_email: z.string().email().optional(),
    payer_name: z.string().optional(),
    note: z.string().max(500).optional(),
    expires_at: z.string().datetime().optional().describe("ISO timestamp when the request expires."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("payment_requests")
      .insert({
        requester_id: ctx.getUserId(),
        amount_cents: input.amount_cents,
        currency: (input.currency ?? "USD").toUpperCase(),
        payer_email: input.payer_email ?? null,
        payer_name: input.payer_name ?? null,
        note: input.note ?? null,
        expires_at: input.expires_at ?? null,
        status: "pending",
      })
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Created payment request ${data.id} for ${(data.amount_cents / 100).toFixed(2)} ${data.currency}.` }],
      structuredContent: { payment_request: data },
    };
  },
});

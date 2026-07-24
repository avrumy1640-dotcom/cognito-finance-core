import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauth } from "../supabaseForUser";

export default defineTool({
  name: "list_payment_requests",
  title: "List payment requests",
  description: "List payment requests the signed-in user created, optionally filtered by status.",
  inputSchema: {
    status: z.enum(["pending", "paid", "cancelled", "expired"]).optional(),
    limit: z.number().int().min(1).max(200).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("payment_requests")
      .select("id, amount_cents, currency, status, payer_email, payer_name, note, expires_at, created_at")
      .eq("requester_id", ctx.getUserId());
    if (status) q = q.eq("status", status);
    q = q.order("created_at", { ascending: false }).limit(limit ?? 50);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { payment_requests: data ?? [] },
    };
  },
});

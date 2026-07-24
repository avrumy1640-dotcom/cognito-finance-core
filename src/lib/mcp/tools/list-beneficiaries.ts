import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauth } from "../supabaseForUser";

export default defineTool({
  name: "list_beneficiaries",
  title: "List beneficiaries",
  description: "List the signed-in user's saved beneficiaries (people and accounts they send money to).",
  inputSchema: {
    favorites_only: z.boolean().optional().describe("Only return favorite beneficiaries."),
    limit: z.number().int().min(1).max(100).optional().describe("Max rows to return (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ favorites_only, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    const sb = supabaseForUser(ctx);
    let q = sb.from("beneficiaries").select("*").eq("user_id", ctx.getUserId());
    if (favorites_only) q = q.eq("favorite", true);
    q = q.order("last_used_at", { ascending: false, nullsFirst: false }).limit(limit ?? 50);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { beneficiaries: data ?? [] },
    };
  },
});

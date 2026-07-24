import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser, unauth } from "../supabaseForUser";

export default defineTool({
  name: "list_scheduled_transfers",
  title: "List scheduled transfers",
  description: "List the signed-in user's upcoming and past scheduled transfers.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("scheduled_transfers")
      .select("id, kind, amount, currency, from_account, to_label, frequency, status, scheduled_for, next_run_at, last_run_at, memo")
      .eq("user_id", ctx.getUserId())
      .order("next_run_at", { ascending: true, nullsFirst: false })
      .limit(100);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { scheduled_transfers: data ?? [] },
    };
  },
});

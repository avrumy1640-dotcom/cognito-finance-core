import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser, unauth } from "../supabaseForUser";

export default defineTool({
  name: "list_support_tickets",
  title: "List support tickets",
  description: "List the signed-in user's support tickets with status and priority.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("support_tickets")
      .select("id, subject, category, priority, status, created_at, updated_at, last_agent_reply_at")
      .eq("user_id", ctx.getUserId())
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { tickets: data ?? [] },
    };
  },
});

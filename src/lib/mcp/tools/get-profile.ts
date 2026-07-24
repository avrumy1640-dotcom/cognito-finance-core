import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser, unauth } from "../supabaseForUser";

export default defineTool({
  name: "get_profile",
  title: "Get my profile",
  description: "Fetch the signed-in user's banking profile (name, contact, address, account type).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb.from("profiles").select("*").eq("id", ctx.getUserId()).maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? {}, null, 2) }],
      structuredContent: { profile: data },
    };
  },
});

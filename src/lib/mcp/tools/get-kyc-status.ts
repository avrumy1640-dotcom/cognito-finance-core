import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser, unauth } from "../supabaseForUser";

export default defineTool({
  name: "get_kyc_status",
  title: "Get KYC status",
  description: "Return the signed-in user's identity-verification (KYC) status and submitted details.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("kyc_profiles")
      .select("id, legal_first_name, legal_last_name, country, city, employment_status, created_at, updated_at")
      .eq("user_id", ctx.getUserId())
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const status = (data ? "submitted" : "not_started");
    return {
      content: [{ type: "text", text: `KYC status: ${status}\n\n${JSON.stringify(data ?? {}, null, 2)}` }],
      structuredContent: { status, profile: data },
    };
  },
});

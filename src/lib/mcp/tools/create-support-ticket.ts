import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauth } from "../supabaseForUser";

export default defineTool({
  name: "create_support_ticket",
  title: "Create support ticket",
  description: "Open a new support ticket on behalf of the signed-in user.",
  inputSchema: {
    subject: z.string().min(3).max(200),
    body: z.string().min(3).max(4000),
    category: z.enum(["account", "payments", "cards", "kyc", "security", "other"]).optional(),
    priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("support_tickets")
      .insert({
        user_id: ctx.getUserId(),
        subject: input.subject,
        body: input.body,
        category: (input.category ?? "other") as any,
        priority: (input.priority ?? "normal") as any,
        status: "open" as any,
      })
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Opened support ticket ${data.id} — ${data.subject}` }],
      structuredContent: { ticket: data },
    };
  },
});

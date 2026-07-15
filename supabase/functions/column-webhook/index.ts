// Column webhook receiver. Register this URL in Column's dashboard as a webhook
// endpoint. It normalizes events into a shape the app can subscribe to via
// Supabase Realtime (broadcast channel `column-events`).
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const payload = await req.json().catch(() => ({}));
    // Column posts events like { id, type, data: { object } }.
    const type: string = payload?.type || "unknown";
    const data = payload?.data?.object || payload?.data || payload;

    console.log(`column-webhook received: ${type}`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Broadcast to all connected clients on the `column-events` channel.
    const channel = supabase.channel("column-events");
    await channel.send({
      type: "broadcast",
      event: type,
      payload: { type, data, receivedAt: new Date().toISOString() },
    });
    await supabase.removeChannel(channel);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("column-webhook error", err);
    return new Response(JSON.stringify({ error: String(err instanceof Error ? err.message : err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

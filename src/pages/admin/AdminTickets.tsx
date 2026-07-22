import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AdminHeader, AdminPage, DataTable, StatusPill } from "./AdminShell";

type Ticket = {
  id: string;
  user_id: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  updated_at: string;
};

type Message = {
  id: string;
  author: string;
  body: string;
  created_at: string;
};

const AdminTickets = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [active, setActive] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase
      .from("support_tickets")
      .select("id, user_id, subject, status, priority, category, updated_at")
      .order("updated_at", { ascending: false })
      .limit(200);
    setTickets((data ?? []) as Ticket[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openTicket = async (t: Ticket) => {
    setActive(t);
    const { data } = await supabase
      .from("support_messages")
      .select("id, author, body, created_at")
      .eq("ticket_id", t.id)
      .order("created_at");
    setMessages((data ?? []) as Message[]);
  };

  const send = async () => {
    if (!active || !user || !reply.trim()) return;
    const { error } = await supabase.from("support_messages").insert({
      ticket_id: active.id,
      user_id: user.id,
      author: "agent",
      body: reply.trim(),
    });
    if (error) { toast.error(error.message); return; }
    await supabase
      .from("support_tickets")
      .update({ status: "waiting_customer", last_agent_reply_at: new Date().toISOString() })
      .eq("id", active.id);
    await supabase.from("audit_logs").insert({
      actor_id: user.id,
      actor_email: user.email,
      action: "ticket.reply",
      entity_type: "support_ticket",
      entity_id: active.id,
      metadata: {},
    });
    setReply("");
    openTicket(active);
    load();
    toast.success("Reply sent");
  };

  const setStatus = async (status: "resolved" | "closed" | "in_progress") => {
    if (!active) return;
    await supabase.from("support_tickets").update({ status }).eq("id", active.id);
    toast.success(`Ticket ${status}`);
    setActive({ ...active, status });
    load();
  };

  return (
    <AdminPage>
      <AdminHeader title="Support tickets" subtitle="Reply, triage, and resolve customer conversations." />
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <DataTable
            rows={tickets}
            empty={loading ? "Loading…" : "No tickets yet"}
            columns={[
              {
                key: "subject",
                header: "Subject",
                render: (r) => (
                  <button onClick={() => openTicket(r)} className="text-left font-medium hover:underline">
                    {r.subject}
                  </button>
                ),
              },
              { key: "cat", header: "Category", render: (r) => r.category.replace("_", " ") },
              { key: "prio", header: "Priority", render: (r) => r.priority },
              { key: "status", header: "Status", render: (r) => <StatusPill status={r.status} /> },
              { key: "updated", header: "Updated", render: (r) => new Date(r.updated_at).toLocaleString() },
            ]}
          />
        </div>
        <div className="rounded-xl border border-border bg-card p-4 flex flex-col max-h-[700px]">
          {!active ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Select a ticket to reply
            </div>
          ) : (
            <>
              <div className="pb-3 border-b border-border">
                <p className="text-sm font-semibold text-foreground">{active.subject}</p>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => setStatus("in_progress")} className="text-xs px-2 py-1 rounded bg-secondary">In progress</button>
                  <button onClick={() => setStatus("resolved")} className="text-xs px-2 py-1 rounded bg-emerald-500 text-white">Resolve</button>
                  <button onClick={() => setStatus("closed")} className="text-xs px-2 py-1 rounded bg-secondary">Close</button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto py-3 space-y-2">
                {messages.map((m) => (
                  <div key={m.id} className={`text-sm p-2.5 rounded-lg ${
                    m.author === "agent" ? "bg-primary/10" : "bg-secondary"
                  }`}>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{m.author}</p>
                    <p className="whitespace-pre-wrap">{m.body}</p>
                  </div>
                ))}
              </div>
              {active.status !== "closed" && (
                <div className="pt-3 border-t border-border">
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    rows={3}
                    placeholder="Reply as agent…"
                    className="w-full p-2 rounded-lg bg-secondary text-sm outline-none resize-none"
                  />
                  <button
                    onClick={send}
                    disabled={!reply.trim()}
                    className="mt-2 w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
                  >
                    Send reply
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AdminPage>
  );
};

export default AdminTickets;

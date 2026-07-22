import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Send, Loader2, CheckCircle2 } from "lucide-react";
import GlassCard from "@/components/glass/GlassCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Message = {
  id: string;
  author: "customer" | "agent" | "system";
  body: string;
  created_at: string;
};

type Ticket = {
  id: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  user_id: string;
};

const SupportTicket = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    if (!id) return;
    const [{ data: t, error: tErr }, { data: m, error: mErr }] = await Promise.all([
      supabase.from("support_tickets").select("id, subject, status, priority, category, user_id").eq("id", id).maybeSingle(),
      supabase.from("support_messages").select("id, author, body, created_at").eq("ticket_id", id).order("created_at"),
    ]);
    if (tErr || mErr) { toast.error((tErr || mErr)!.message); setLoading(false); return; }
    if (!t) { toast.error("Ticket not found"); navigate("/support"); return; }
    setTicket(t as Ticket);
    setMessages((m ?? []) as Message[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`support-${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages", filter: `ticket_id=eq.${id}` },
        (payload) => {
          setMessages((prev) =>
            prev.some((m) => m.id === (payload.new as Message).id) ? prev : [...prev, payload.new as Message]
          );
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const body = draft.trim();
    if (!body || !user || !ticket) return;
    if (ticket.status === "closed") { toast.error("Ticket is closed"); return; }
    setSending(true);
    const { error } = await supabase.from("support_messages").insert({
      ticket_id: ticket.id,
      user_id: user.id,
      author: "customer",
      body,
    });
    if (error) { toast.error(error.message); setSending(false); return; }
    const nextStatus = ticket.status === "waiting_customer" ? "in_progress" : ticket.status;
    await supabase
      .from("support_tickets")
      .update({ last_customer_reply_at: new Date().toISOString(), status: nextStatus as Ticket["status"] })
      .eq("id", ticket.id);
    setDraft("");
    setSending(false);
  };

  const markResolved = async () => {
    if (!ticket) return;
    const { error } = await supabase.from("support_tickets").update({ status: "resolved" }).eq("id", ticket.id);
    if (error) { toast.error(error.message); return; }
    setTicket({ ...ticket, status: "resolved" });
    toast.success("Ticket marked as resolved");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="px-5 pt-14 pb-3 flex items-center gap-3 border-b border-border">
        <button onClick={() => navigate("/support")} className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
          <ArrowLeft size={20} className="text-foreground" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-display font-bold text-foreground truncate">{ticket?.subject ?? "Ticket"}</p>
          <p className="text-[11px] text-muted-foreground capitalize">
            {ticket ? `${ticket.category.replace("_", " ")} · ${ticket.status.replace("_", " ")} · ${ticket.priority}` : ""}
          </p>
        </div>
        {ticket && ticket.status !== "resolved" && ticket.status !== "closed" && (
          <button onClick={markResolved} className="text-xs text-primary font-medium flex items-center gap-1">
            <CheckCircle2 size={14} /> Resolve
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loading ? (
          <div className="text-center text-sm text-muted-foreground pt-10">
            <Loader2 className="animate-spin inline mr-2" size={16} /> Loading conversation…
          </div>
        ) : messages.length === 0 ? (
          <GlassCard className="text-center text-sm text-muted-foreground py-6">
            No messages yet.
          </GlassCard>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex ${m.author === "customer" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap ${
                  m.author === "customer"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : m.author === "agent"
                    ? "bg-secondary text-foreground rounded-bl-md"
                    : "bg-muted/50 text-muted-foreground text-xs italic mx-auto"
                }`}
              >
                {m.body}
                <div className={`text-[10px] mt-1 ${m.author === "customer" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {ticket?.status === "closed" ? (
        <div className="px-4 py-4 border-t border-border text-center text-xs text-muted-foreground">
          This ticket is closed. Start a new one if you need more help.
        </div>
      ) : (
        <div className="px-4 py-3 border-t border-border flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Type a message…"
            rows={1}
            maxLength={4000}
            className="flex-1 p-3 rounded-2xl bg-secondary text-foreground text-sm border-0 outline-none resize-none max-h-32"
          />
          <button
            onClick={send}
            disabled={sending || !draft.trim()}
            className="w-11 h-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50"
            aria-label="Send"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      )}
    </div>
  );
};

export default SupportTicket;

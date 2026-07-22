import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { z } from "zod";
import { ArrowLeft, Plus, MessageSquare, AlertTriangle, ChevronRight, Loader2 } from "lucide-react";
import GlassCard from "@/components/glass/GlassCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Ticket = {
  id: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  updated_at: string;
};

const CATEGORIES = [
  { value: "question", label: "General question" },
  { value: "problem", label: "Report a problem" },
  { value: "dispute", label: "Transaction dispute" },
  { value: "feature_request", label: "Feature request" },
  { value: "other", label: "Other" },
] as const;

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
] as const;

const ticketSchema = z.object({
  subject: z.string().trim().min(4, "Subject too short").max(120),
  body: z.string().trim().min(10, "Please add more detail").max(4000),
  category: z.enum(["question", "problem", "dispute", "feature_request", "other"]),
  priority: z.enum(["low", "normal", "high", "urgent"]),
});

const statusStyles: Record<string, string> = {
  open: "bg-primary/10 text-primary",
  in_progress: "bg-blue-500/10 text-blue-600",
  waiting_customer: "bg-amber-500/10 text-amber-600",
  resolved: "bg-emerald-500/10 text-emerald-600",
  closed: "bg-secondary text-muted-foreground",
};

const Support = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const params = new URLSearchParams(window.location.search);
  const initialCategory = (params.get("category") as (typeof CATEGORIES)[number]["value"]) || "question";

  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [mode, setMode] = useState<"list" | "new">(params.get("new") ? "new" : "list");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    subject: "",
    body: "",
    category: initialCategory,
    priority: "normal" as (typeof PRIORITIES)[number]["value"],
  });

  const load = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("support_tickets")
      .select("id, subject, status, priority, category, updated_at")
      .order("updated_at", { ascending: false });
    if (error) { toast.error(error.message); return; }
    setTickets(data as Ticket[]);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  const submit = async () => {
    const parsed = ticketSchema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    if (!user) return;
    setSubmitting(true);
    const { data, error } = await supabase
      .from("support_tickets")
      .insert({
        user_id: user.id,
        subject: parsed.data.subject,
        body: parsed.data.body,
        category: parsed.data.category,
        priority: parsed.data.priority,
        last_customer_reply_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) { toast.error(error.message); setSubmitting(false); return; }

    await supabase.from("support_messages").insert({
      ticket_id: data!.id,
      user_id: user.id,
      author: "customer",
      body: parsed.data.body,
    });

    setSubmitting(false);
    toast.success("Ticket submitted — a specialist will reply shortly");
    navigate(`/support/${data!.id}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="px-5 pt-14 pb-10 space-y-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => (mode === "new" ? setMode("list") : navigate(-1))}
            className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center"
            aria-label="Back"
          >
            <ArrowLeft size={20} className="text-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-display font-bold text-foreground">
              {mode === "new" ? "New ticket" : "Support"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {mode === "new" ? "We usually reply within an hour" : "Your conversations with the Glass Bank team"}
            </p>
          </div>
          {mode === "list" && (
            <button
              onClick={() => setMode("new")}
              className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
              aria-label="New ticket"
            >
              <Plus size={18} />
            </button>
          )}
        </div>

        {mode === "list" ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => { setForm((f) => ({ ...f, category: "question" })); setMode("new"); }} className="text-left">
                <GlassCard className="py-4">
                  <MessageSquare size={20} className="text-primary mb-2" />
                  <p className="text-sm font-semibold text-foreground">Start a chat</p>
                  <p className="text-xs text-muted-foreground">Ask a specialist a question</p>
                </GlassCard>
              </button>
              <button onClick={() => { setForm((f) => ({ ...f, category: "problem", priority: "high" })); setMode("new"); }} className="text-left">
                <GlassCard className="py-4">
                  <AlertTriangle size={20} className="text-amber-500 mb-2" />
                  <p className="text-sm font-semibold text-foreground">Report a problem</p>
                  <p className="text-xs text-muted-foreground">Something isn't working right</p>
                </GlassCard>
              </button>
            </div>

            <div>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                Recent tickets
              </h2>
              {tickets === null ? (
                <GlassCard className="text-center py-6 text-sm text-muted-foreground">
                  <Loader2 className="animate-spin inline mr-2" size={16} /> Loading…
                </GlassCard>
              ) : tickets.length === 0 ? (
                <GlassCard className="text-center py-8 text-sm text-muted-foreground">
                  No tickets yet. Start one anytime.
                </GlassCard>
              ) : (
                <GlassCard className="divide-y divide-border p-0 overflow-hidden">
                  {tickets.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => navigate(`/support/${t.id}`)}
                      className="w-full text-left px-4 py-3 flex items-center gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{t.subject}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusStyles[t.status] ?? "bg-secondary"}`}>
                            {t.status.replace("_", " ")}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {new Date(t.updated_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-muted-foreground" />
                    </button>
                  ))}
                </GlassCard>
              )}
            </div>
          </>
        ) : (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <GlassCard className="space-y-3">
              <Field label="Category">
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value as typeof form.category })}
                  className="w-full p-2 rounded-lg bg-secondary text-foreground text-sm border-0 outline-none"
                >
                  {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </Field>
              <Field label="Priority">
                <div className="grid grid-cols-4 gap-2">
                  {PRIORITIES.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => setForm({ ...form, priority: p.value })}
                      className={`py-2 rounded-lg text-xs font-medium border ${
                        form.priority === p.value
                          ? "border-primary bg-primary/5 text-foreground"
                          : "border-border bg-secondary text-muted-foreground"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Subject">
                <input
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="Short summary"
                  maxLength={120}
                  className="w-full p-2 rounded-lg bg-secondary text-foreground text-sm border-0 outline-none"
                />
              </Field>
              <Field label="What's going on?">
                <textarea
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  rows={6}
                  maxLength={4000}
                  placeholder="Add as much detail as you can. Include transaction dates or amounts if relevant."
                  className="w-full p-2 rounded-lg bg-secondary text-foreground text-sm border-0 outline-none resize-none"
                />
              </Field>
            </GlassCard>

            <button
              disabled={submitting}
              onClick={submit}
              className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              Submit ticket
            </button>
            <p className="text-center text-xs text-muted-foreground">
              For urgent card loss or fraud, call the number on the back of your card.
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{label}</label>
    {children}
  </div>
);

export default Support;

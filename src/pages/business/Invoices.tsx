import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Plus, Loader2, FileText, Trash2, Send, CheckCircle2, Ban, X } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import GlassCard from "@/components/glass/GlassCard";
import Seo from "@/components/Seo";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { money } from "./BusinessHome";

type LineItem = { description: string; qty: number; unit: number };

interface Invoice {
  id: string;
  invoice_number: string;
  client_name: string;
  client_email: string | null;
  line_items: unknown;
  amount_cents: number;
  issue_date: string;
  due_date: string | null;
  notes: string | null;
  status: string;
}

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-secondary text-muted-foreground",
  sent: "bg-primary/10 text-primary",
  paid: "bg-success/10 text-success",
  overdue: "bg-destructive/10 text-destructive",
  void: "bg-secondary text-muted-foreground line-through",
};

const emptyItem = (): LineItem => ({ description: "", qty: 1, unit: 0 });

const Invoices = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<Invoice[] | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [client, setClient] = useState("");
  const [email, setEmail] = useState("");
  const [due, setDue] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([emptyItem()]);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("invoices").select("*").order("created_at", { ascending: false });
    if (error) { toast.error(error.message); setRows([]); return; }
    const list = (data ?? []) as Invoice[];
    // An invoice past its due date is overdue — computed on load and written
    // back once so every screen (and the "you're owed" total) agrees.
    const today = new Date(new Date().toDateString());
    const stale = list.filter((r) => r.status === "sent" && r.due_date && new Date(r.due_date) < today);
    if (stale.length) {
      await supabase.from("invoices").update({ status: "overdue" }).in("id", stale.map((r) => r.id));
      for (const r of stale) r.status = "overdue";
    }
    setRows(list);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const totalCents = useMemo(
    () => items.reduce((s, i) => s + Math.round((Number(i.qty) || 0) * (Number(i.unit) || 0) * 100), 0),
    [items],
  );

  const nextNumber = () => {
    const used = (rows ?? [])
      .map((r) => Number(String(r.invoice_number).replace(/\D/g, "")))
      .filter((n) => !Number.isNaN(n));
    const next = (used.length ? Math.max(...used) : 0) + 1;
    return `INV-${String(next).padStart(4, "0")}`;
  };

  const reset = () => {
    setClient(""); setEmail(""); setDue(""); setNotes(""); setItems([emptyItem()]);
  };

  const create = async () => {
    if (!user) return;
    if (client.trim().length < 2) return toast.error("Add the client's name");
    if (totalCents <= 0) return toast.error("Add at least one line item with an amount");
    setBusy(true);
    const { error } = await supabase.from("invoices").insert({
      user_id: user.id,
      invoice_number: nextNumber(),
      client_name: client.trim(),
      client_email: email.trim() || null,
      line_items: items.filter((i) => i.description.trim()) as unknown as never,
      amount_cents: totalCents,
      due_date: due || null,
      notes: notes.trim() || null,
      status: "draft",
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Invoice created");
    setOpen(false); reset(); void load();
  };

  const setStatus = async (inv: Invoice, status: string) => {
    const patch: { status: string; sent_at?: string; paid_at?: string } = { status };
    if (status === "sent") patch.sent_at = new Date().toISOString();
    if (status === "paid") patch.paid_at = new Date().toISOString();
    const { error } = await supabase.from("invoices").update(patch).eq("id", inv.id);
    if (error) return toast.error(error.message);
    toast.success(`${inv.invoice_number} marked ${status}`);
    void load();
  };

  const remove = async (inv: Invoice) => {
    const { error } = await supabase.from("invoices").delete().eq("id", inv.id);
    if (error) return toast.error(error.message);
    toast.success("Draft deleted");
    void load();
  };

  const outstanding = (rows ?? [])
    .filter((r) => ["sent", "overdue"].includes(r.status))
    .reduce((s, r) => s + r.amount_cents, 0);

  return (
    <AppLayout>
      <Seo title="Invoices | Glass Bank" description="Create, send and track business invoices." path="/invoices" noindex />
      <div className="px-5 sm:px-6 lg:px-0 pt-10 sm:pt-12 space-y-5 pb-8">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Invoices</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {money(outstanding / 100)} outstanding
            </p>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="shrink-0 min-h-11 px-4 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-1.5"
          >
            <Plus size={16} /> New
          </button>
        </motion.div>

        {!rows && <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" /></div>}
        {rows?.length === 0 && (
          <GlassCard className="text-center py-10">
            <FileText className="mx-auto text-muted-foreground mb-2" />
            <p className="text-sm font-semibold text-foreground">No invoices yet</p>
            <p className="text-xs text-muted-foreground mt-1">Bill a client and track it through to payment.</p>
          </GlassCard>
        )}

        <div className="space-y-2">
          {(rows ?? []).map((inv) => (
            <GlassCard key={inv.id} className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{inv.client_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {inv.invoice_number} · issued {new Date(inv.issue_date).toLocaleDateString()}
                    {inv.due_date && ` · due ${new Date(inv.due_date).toLocaleDateString()}`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-foreground tabular-nums">{money(inv.amount_cents / 100)}</p>
                  <span className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[inv.status] ?? "bg-secondary"}`}>
                    {inv.status}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {inv.status === "draft" && (
                  <>
                    <button onClick={() => setStatus(inv, "sent")} className="btn-full text-xs font-semibold px-3 py-2 rounded-xl bg-secondary text-foreground flex items-center gap-1.5">
                      <Send size={13} /> Mark sent
                    </button>
                    <button onClick={() => remove(inv)} className="btn-full text-xs font-semibold px-3 py-2 rounded-xl bg-destructive/10 text-destructive flex items-center gap-1.5">
                      <Trash2 size={13} /> Delete
                    </button>
                  </>
                )}
                {["sent", "overdue"].includes(inv.status) && (
                  <>
                    <button onClick={() => setStatus(inv, "paid")} className="btn-full text-xs font-semibold px-3 py-2 rounded-xl bg-success/10 text-success flex items-center gap-1.5">
                      <CheckCircle2 size={13} /> Mark paid
                    </button>
                    <button onClick={() => setStatus(inv, "void")} className="btn-full text-xs font-semibold px-3 py-2 rounded-xl bg-secondary text-muted-foreground flex items-center gap-1.5">
                      <Ban size={13} /> Void
                    </button>
                  </>
                )}
              </div>
            </GlassCard>
          ))}
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-lg bg-card rounded-3xl border border-border p-5 space-y-3 sheet-gap max-h-[78vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-display font-bold text-foreground">New invoice</h2>
              <button onClick={() => setOpen(false)} aria-label="Close"><X size={18} className="text-muted-foreground" /></button>
            </div>

            <input value={client} onChange={(e) => setClient(e.target.value)} placeholder="Client name"
              className="w-full px-4 py-3 rounded-2xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Client email (optional)" type="email"
              className="w-full px-4 py-3 rounded-2xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />

            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Line items</p>
              {items.map((it, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={it.description}
                    onChange={(e) => setItems(items.map((x, j) => j === i ? { ...x, description: e.target.value } : x))}
                    placeholder="Description"
                    className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <input
                    value={it.qty}
                    onChange={(e) => setItems(items.map((x, j) => j === i ? { ...x, qty: Number(e.target.value) } : x))}
                    type="number" min={1} aria-label="Quantity"
                    className="w-16 px-2 py-2.5 rounded-xl bg-secondary border border-border text-sm text-foreground text-center focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <input
                    value={it.unit}
                    onChange={(e) => setItems(items.map((x, j) => j === i ? { ...x, unit: Number(e.target.value) } : x))}
                    type="number" min={0} step="0.01" aria-label="Unit price"
                    className="w-24 px-2 py-2.5 rounded-xl bg-secondary border border-border text-sm text-foreground text-right focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              ))}
              <button onClick={() => setItems([...items, emptyItem()])} className="text-xs font-semibold text-primary flex items-center gap-1">
                <Plus size={13} /> Add line
              </button>
            </div>

            <div className="flex gap-2">
              <input value={due} onChange={(e) => setDue(e.target.value)} type="date" aria-label="Due date"
                className="flex-1 px-4 py-3 rounded-2xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" rows={2}
              className="w-full px-4 py-3 rounded-2xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />

            <div className="flex items-center justify-between pt-1">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-lg font-display font-bold text-foreground tabular-nums">{money(totalCents / 100)}</span>
            </div>
            <button onClick={create} disabled={busy}
              className="w-full min-h-12 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />} Create invoice
            </button>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default Invoices;

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Plus, Loader2, Receipt, X, CheckCircle2, Trash2, CalendarClock, AlertTriangle, Send,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import GlassCard from "@/components/glass/GlassCard";
import Seo from "@/components/Seo";
import { supabase } from "@/integrations/supabase/client";
import { ledgerProvider, type ProviderAccount } from "@/lib/ledgerProvider";
import { useAuth } from "@/hooks/useAuth";
import { money } from "./BusinessHome";

interface Bill {
  id: string;
  vendor_name: string;
  amount_cents: number;
  due_date: string | null;
  status: string;
  memo: string | null;
  bank_account_id: string | null;
  paid_at: string | null;
}

const STATUS_STYLE: Record<string, string> = {
  unpaid: "bg-secondary text-muted-foreground",
  scheduled: "bg-primary/10 text-primary",
  paid: "bg-success/10 text-success",
  overdue: "bg-destructive/10 text-destructive",
  void: "bg-secondary text-muted-foreground line-through",
};

const isOverdue = (b: Bill) =>
  b.status === "unpaid" && !!b.due_date && new Date(b.due_date) < new Date(new Date().toDateString());

/**
 * Accounts payable. A bill is a record of something owed — paying it hands
 * off to the real ACH/wire flow, which is the only thing that can actually
 * move money.
 */
const Bills = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rows, setRows] = useState<Bill[] | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [due, setDue] = useState("");
  const [memo, setMemo] = useState("");
  const [accounts, setAccounts] = useState<ProviderAccount[]>([]);
  const [accountId, setAccountId] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("bills").select("*").order("due_date", { ascending: true, nullsFirst: false });
    if (error) { toast.error(error.message); setRows([]); return; }
    setRows((data ?? []) as Bill[]);
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Bills are owed *by* a specific account, so the payer is chosen up front.
  useEffect(() => {
    void (async () => {
      try {
        const snap = await ledgerProvider.sync({ limit: 1 });
        const usable = snap.accounts.filter((a) => a.myRole !== "viewer");
        setAccounts(usable);
        setAccountId((prev) => prev || usable[0]?.id || "");
      } catch { /* the list still works without it */ }
    })();
  }, []);

  const outstanding = useMemo(
    () => (rows ?? []).filter((r) => ["unpaid", "scheduled"].includes(r.status))
      .reduce((s, r) => s + r.amount_cents, 0) / 100,
    [rows],
  );
  const overdueTotal = useMemo(
    () => (rows ?? []).filter(isOverdue).reduce((s, r) => s + r.amount_cents, 0) / 100,
    [rows],
  );

  const reset = () => { setVendor(""); setAmount(""); setDue(""); setMemo(""); };

  const create = async () => {
    if (!user) return;
    const cents = Math.round(Number(amount) * 100);
    if (vendor.trim().length < 2) return toast.error("Who is this bill from?");
    if (!cents || cents <= 0) return toast.error("Enter the amount owed");
    if (!accountId) return toast.error("Choose which account this is paid from");
    setBusy(true);
    const { error } = await supabase.from("bills").insert({
      user_id: user.id,
      bank_account_id: accountId,
      vendor_name: vendor.trim(),
      amount_cents: cents,
      due_date: due || null,
      memo: memo.trim() || null,
      status: "unpaid",
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Bill added");
    setOpen(false); reset(); void load();
  };

  const setStatus = async (bill: Bill, status: string) => {
    const patch: { status: string; paid_at?: string | null } = { status };
    if (status === "paid") patch.paid_at = new Date().toISOString();
    const { error } = await supabase.from("bills").update(patch).eq("id", bill.id);
    if (error) return toast.error(error.message);
    toast.success(`${bill.vendor_name} marked ${status}`);
    void load();
  };

  const remove = async (bill: Bill) => {
    const { error } = await supabase.from("bills").delete().eq("id", bill.id);
    if (error) return toast.error(error.message);
    toast.success("Bill deleted");
    void load();
  };

  return (
    <AppLayout>
      <Seo title="Bills to pay | Glass Bank" description="Track what your business owes, when it's due, and pay it." path="/bills" noindex />
      <div className="px-5 sm:px-6 lg:px-0 pt-10 sm:pt-12 space-y-5 pb-8">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Bills to pay</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {money(outstanding)} outstanding
              {overdueTotal > 0 && <span className="text-destructive"> · {money(overdueTotal)} overdue</span>}
            </p>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="shrink-0 min-h-11 px-4 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-1.5"
          >
            <Plus size={16} /> Add bill
          </button>
        </motion.div>

        {!!rows?.length && (
          <FilterShell
            search={search}
            onSearch={setSearch}
            placeholder="Search vendor or memo…"
            activeCount={advancedCount}
            onClear={clearAll}
            chips={STATUS_FILTERS.map((s) => (
              <FilterChip
                key={s}
                label={s === "All" ? "All" : s[0].toUpperCase() + s.slice(1)}
                active={statusFilter === s}
                onClick={() => setStatusFilter(s)}
                count={
                  s === "All"
                    ? rows.length
                    : rows.filter((r) => (isOverdue(r) ? "overdue" : r.status) === s).length
                }
              />
            ))}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <DateRangeField label="Due date" from={dueFrom} to={dueTo} onFrom={setDueFrom} onTo={setDueTo} />
              <AmountRangeField min={minAmount} max={maxAmount} onMin={setMinAmount} onMax={setMaxAmount} />
            </div>
          </FilterShell>
        )}

        {!rows && <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" /></div>}
        {rows?.length === 0 && (
          <GlassCard className="text-center py-10">
            <Receipt className="mx-auto text-muted-foreground mb-2" />
            <p className="text-sm font-semibold text-foreground">No bills tracked</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add what you owe so nothing slips past its due date.
            </p>
          </GlassCard>
        )}
        {!!rows?.length && visible.length === 0 && (
          <GlassCard className="text-center py-8">
            <p className="text-sm font-semibold text-foreground">No bills match these filters</p>
            <button onClick={clearAll} className="text-xs font-semibold text-primary mt-2">Reset filters</button>
          </GlassCard>
        )}

        <div className="space-y-2">
          {visible.map((b) => {

            const status = isOverdue(b) ? "overdue" : b.status;
            return (
              <GlassCard key={b.id} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{b.vendor_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {b.due_date ? `Due ${new Date(b.due_date).toLocaleDateString()}` : "No due date"}
                      {b.memo && ` · ${b.memo}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-foreground tabular-nums">{money(b.amount_cents / 100)}</p>
                    <span className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[status]}`}>
                      {status}
                    </span>
                  </div>
                </div>

                {["unpaid", "scheduled"].includes(b.status) && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => navigate("/move-money/external")}
                      className="btn-full text-xs font-semibold px-3 py-2 rounded-xl bg-primary text-primary-foreground flex items-center gap-1.5"
                    >
                      <Send size={13} /> Pay by ACH
                    </button>
                    <button
                      onClick={() => navigate("/scheduled")}
                      className="btn-full text-xs font-semibold px-3 py-2 rounded-xl bg-secondary text-foreground flex items-center gap-1.5"
                    >
                      <CalendarClock size={13} /> Schedule
                    </button>
                    <button
                      onClick={() => setStatus(b, "paid")}
                      className="btn-full text-xs font-semibold px-3 py-2 rounded-xl bg-success/10 text-success flex items-center gap-1.5"
                    >
                      <CheckCircle2 size={13} /> Mark paid
                    </button>
                    <button
                      onClick={() => remove(b)}
                      className="btn-full text-xs font-semibold px-3 py-2 rounded-xl bg-destructive/10 text-destructive flex items-center gap-1.5"
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                )}
              </GlassCard>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground flex items-start gap-1.5 px-1">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          Marking a bill paid only updates your records — use Pay by ACH or Schedule to actually send money.
        </p>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-md bg-card rounded-3xl border border-border p-5 space-y-3 sheet-gap max-h-[78vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-display font-bold text-foreground">Add a bill</h2>
              <button onClick={() => setOpen(false)} aria-label="Close"><X size={18} className="text-muted-foreground" /></button>
            </div>
            <input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Vendor or supplier"
              className="w-full px-4 py-3 rounded-2xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            <label className="block">
              <span className="text-xs text-muted-foreground">Paid from</span>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)}
                className="mt-1 w-full px-4 py-3 rounded-2xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                {accounts.length === 0 && <option value="">Loading accounts…</option>}
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="0" step="0.01" placeholder="Amount owed"
              className="w-full px-4 py-3 rounded-2xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            <label className="block">
              <span className="text-xs text-muted-foreground">Due date (optional)</span>
              <input value={due} onChange={(e) => setDue(e.target.value)} type="date"
                className="mt-1 w-full px-4 py-3 rounded-2xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </label>
            <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Reference (optional)"
              className="w-full px-4 py-3 rounded-2xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            <button onClick={create} disabled={busy}
              className="w-full min-h-12 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Add bill
            </button>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default Bills;

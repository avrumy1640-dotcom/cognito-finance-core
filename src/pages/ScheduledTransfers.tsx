import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import AppLayout from "@/components/layout/AppLayout";
import GlassCard from "@/components/glass/GlassCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBank } from "@/store/bankStore";
import { CalendarClock, Plus, X, Edit3, Play, ArrowLeft, CheckCircle2, AlertCircle, Pause } from "lucide-react";
import { FEE_TIMING, formatUsd, type TransferKind } from "@/lib/txPolicy";

interface ScheduledTransfer {
  id: string;
  kind: TransferKind;
  from_account: string;
  to_label: string;
  amount: number;
  currency: string;
  memo: string | null;
  scheduled_for: string;
  timezone: string;
  frequency: "once" | "weekly" | "biweekly" | "monthly";
  status: "scheduled" | "processing" | "completed" | "failed" | "cancelled";
  last_run_at: string | null;
  last_error: string | null;
  next_run_at: string | null;
  last_transaction_ref: string | null;
  needs_attention: boolean;
  metadata: Record<string, unknown>;
}

const statusMeta: Record<ScheduledTransfer["status"], { label: string; className: string; icon: typeof CheckCircle2 }> = {
  scheduled: { label: "Scheduled", className: "text-primary bg-primary/10", icon: CalendarClock },
  processing: { label: "Processing", className: "text-warning bg-warning/10", icon: Pause },
  completed: { label: "Completed", className: "text-success bg-success/10", icon: CheckCircle2 },
  failed: { label: "Failed", className: "text-destructive bg-destructive/10", icon: AlertCircle },
  cancelled: { label: "Cancelled", className: "text-muted-foreground bg-secondary", icon: X },
};

const kindLabel: Record<TransferKind, string> = {
  internal: "Between accounts",
  send: "Send to person",
  external: "ACH transfer",
  wire: "Wire transfer",
  bill: "Bill payment",
  deposit: "Check deposit",
};

const localTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

const nextRunFor = (freq: ScheduledTransfer["frequency"], scheduledFor: string) => {
  const base = new Date(scheduledFor);
  const n = new Date(base);
  if (freq === "weekly") n.setDate(n.getDate() + 7);
  else if (freq === "biweekly") n.setDate(n.getDate() + 14);
  else if (freq === "monthly") n.setMonth(n.getMonth() + 1);
  else return null;
  return n.toISOString();
};

const ScheduledTransfers = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { accounts } = useBank();
  const [runningId, setRunningId] = useState<string | null>(null);
  const [rows, setRows] = useState<ScheduledTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ScheduledTransfer | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("scheduled_transfers")
      .select("*")
      .order("scheduled_for", { ascending: true });
    if (error) toast.error("Couldn't load scheduled transfers", { description: error.message });
    else setRows((data as ScheduledTransfer[]) || []);
    setLoading(false);
  };

  useEffect(() => { if (user) load(); }, [user]);

  const cancel = async (r: ScheduledTransfer) => {
    if (!confirm(`Cancel scheduled ${kindLabel[r.kind]} of ${formatUsd(r.amount)}?`)) return;
    const { error } = await supabase.from("scheduled_transfers").update({ status: "cancelled" }).eq("id", r.id);
    if (error) return toast.error("Cancel failed", { description: error.message });
    toast.success("Scheduled transfer cancelled");
    load();
  };

  // Genuine execution: the same server-side executor pg_cron calls, which
  // performs the transfer with server-resolved ownership checks and
  // per-occurrence idempotency. The UI never fakes a status change.
  const runNow = async (r: ScheduledTransfer) => {
    setRunningId(r.id);
    const t = toast.loading("Running scheduled transfer…");
    const { data, error } = await supabase.functions.invoke("run-scheduled-transfers", {
      body: { schedule_id: r.id },
    });
    setRunningId(null);
    if (error) {
      toast.error("Couldn't run transfer", { id: t, description: error.message });
      load();
      return;
    }
    const res = (data as { results?: Array<{ ok?: boolean; error?: string; skipped?: string }> })?.results?.[0];
    if (!res) toast.info("Nothing to run for this schedule right now.", { id: t });
    else if (res.skipped) toast.info("This occurrence already ran.", { id: t });
    else if (res.ok) toast.success("Transfer executed", { id: t });
    else toast.error("Transfer failed", { id: t, description: res.error || "Check balance and details." });
    load();
  };

  return (
    <AppLayout>
      <div className="px-5 pt-14 space-y-5 pb-8">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center" aria-label="Back">
            <ArrowLeft size={20} className="text-foreground" />
          </button>
          <div className="flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">Automate</p>
            <h1 className="text-[22px] font-display font-bold text-foreground leading-tight">Scheduled transfers</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Timezone-aware execution · Edit or cancel any time</p>
          </div>
          <button onClick={() => { setEditing(null); setShowForm(true); }} className="w-10 h-10 rounded-full gradient-hero flex items-center justify-center" aria-label="New">
            <Plus size={20} className="text-primary-foreground" />
          </button>
        </div>

        {loading && <GlassCard className="text-center py-8 text-sm text-muted-foreground">Loading…</GlassCard>}

        {!loading && rows.length === 0 && (
          <GlassCard className="text-center py-10">
            <div className="w-14 h-14 rounded-2xl gradient-hero mx-auto flex items-center justify-center mb-3">
              <CalendarClock size={24} className="text-primary-foreground" />
            </div>
            <p className="text-sm font-semibold text-foreground">No scheduled transfers yet</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">Automate rent, savings, or recurring bills.</p>
            <button onClick={() => { setEditing(null); setShowForm(true); }} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">
              Schedule a transfer
            </button>
          </GlassCard>
        )}

        <div className="space-y-2">
          {rows.map((r) => {
            const meta = statusMeta[r.status];
            const dt = new Date(r.scheduled_for);
            const local = dt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: r.timezone });
            return (
              <GlassCard key={r.id} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                      <meta.icon size={18} className={meta.className.split(" ")[0]} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{kindLabel[r.kind]} → {r.to_label}</p>
                      <p className="text-lg font-bold text-foreground mt-0.5">{formatUsd(r.amount)}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{local} · {r.timezone} · {r.frequency}</p>
                      {r.last_run_at && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Last run {new Date(r.last_run_at).toLocaleString()}
                          {r.last_transaction_ref ? ` · ref ${r.last_transaction_ref}` : ""}
                        </p>
                      )}
                      {r.next_run_at && (
                        <p className="text-[11px] text-muted-foreground">Next run {new Date(r.next_run_at).toLocaleString()}</p>
                      )}
                      {r.last_error && <p className="text-[11px] text-destructive mt-1">{r.last_error}</p>}
                      {r.needs_attention && (
                        <p className="text-[11px] text-destructive mt-1 font-medium">
                          Paused after repeated failures — fix the details and run it again.
                        </p>
                      )}
                    </div>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${meta.className}`}>{meta.label}</span>
                </div>
                {(r.status === "scheduled" || r.status === "failed") && (
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => void runNow(r)} disabled={runningId === r.id} className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center gap-1 disabled:opacity-60">
                      <Play size={12} /> {runningId === r.id ? "Running…" : "Run now"}
                    </button>
                    <button onClick={() => { setEditing(r); setShowForm(true); }} className="flex-1 py-2 rounded-lg bg-secondary text-foreground text-xs font-semibold flex items-center justify-center gap-1">
                      <Edit3 size={12} /> Edit
                    </button>
                    <button onClick={() => cancel(r)} className="flex-1 py-2 rounded-lg bg-secondary text-destructive text-xs font-semibold flex items-center justify-center gap-1">
                      <X size={12} /> Cancel
                    </button>
                  </div>
                )}
              </GlassCard>
            );
          })}
        </div>
      </div>

      {showForm && (
        <ScheduleForm
          initial={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); load(); }}
          accountsAvailable={Object.keys(accounts)}
        />
      )}
    </AppLayout>
  );
};

const ScheduleForm = ({ initial, onClose, onSaved, accountsAvailable }: {
  initial: ScheduledTransfer | null;
  onClose: () => void;
  onSaved: () => void;
  accountsAvailable: string[];
}) => {
  const { user } = useAuth();
  const [kind, setKind] = useState<TransferKind>(initial?.kind || "internal");
  const [fromAccount, setFromAccount] = useState(initial?.from_account || accountsAvailable[0] || "checking");
  const [toLabel, setToLabel] = useState(initial?.to_label || "");
  const [amount, setAmount] = useState<string>(initial ? String(initial.amount) : "");
  const [memo, setMemo] = useState(initial?.memo || "");
  const [date, setDate] = useState(
    initial ? new Date(initial.scheduled_for).toISOString().slice(0, 16) : new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 16)
  );
  const [timezone, setTimezone] = useState(initial?.timezone || localTz());
  const [frequency, setFrequency] = useState<ScheduledTransfer["frequency"]>(initial?.frequency || "once");
  const [saving, setSaving] = useState(false);

  const info = FEE_TIMING[kind];
  const num = Number(amount);

  const save = async () => {
    if (!num || num <= 0) return toast.error("Enter an amount");
    if (!toLabel.trim()) return toast.error("Enter a recipient");
    setSaving(true);
    const scheduledFor = new Date(date).toISOString();
    const payload = {
      user_id: user?.id,
      kind, from_account: fromAccount, to_label: toLabel.trim(), amount: num,
      currency: "USD", memo: memo.trim() || null,
      scheduled_for: scheduledFor, timezone, frequency,
      status: "scheduled" as const,
      next_run_at: frequency === "once" ? null : nextRunFor(frequency, scheduledFor),
      metadata: {},
    };
    const { error } = initial
      ? await supabase.from("scheduled_transfers").update(payload).eq("id", initial.id)
      : await supabase.from("scheduled_transfers").insert(payload);
    setSaving(false);
    if (error) return toast.error("Save failed", { description: error.message });
    toast.success(initial ? "Schedule updated" : "Transfer scheduled", { description: `${new Date(scheduledFor).toLocaleString()} · ${timezone}` });
    onSaved();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }}
        transition={{ type: "spring", damping: 32, stiffness: 320 }}
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl p-5 max-h-[92vh] overflow-y-auto safe-bottom"
      >
        <div className="w-10 h-1 rounded-full bg-border mx-auto mb-5" />
        <h2 className="text-xl font-display font-bold text-foreground mb-1">{initial ? "Edit scheduled" : "New scheduled transfer"}</h2>
        <p className="text-xs text-muted-foreground mb-5">Runs on your chosen timezone. You can edit or cancel any time.</p>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Type</label>
            <select value={kind} onChange={(e) => setKind(e.target.value as TransferKind)} className="w-full p-3 rounded-xl bg-secondary text-foreground text-sm outline-none border-0">
              <option value="internal">Between my accounts</option>
              <option value="send">Send to a person</option>
              <option value="external">ACH to external bank</option>
              <option value="wire">Wire transfer</option>
              <option value="bill">Bill payment</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-medium mb-1.5 block">From account</label>
            <select value={fromAccount} onChange={(e) => setFromAccount(e.target.value)} className="w-full p-3 rounded-xl bg-secondary text-foreground text-sm outline-none border-0">
              {accountsAvailable.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Recipient / destination label</label>
            <input value={toLabel} onChange={(e) => setToLabel(e.target.value)} placeholder={kind === "internal" ? "checking or savings" : "Name or account label"} className="w-full p-3 rounded-xl bg-secondary text-foreground text-sm outline-none border-0" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Amount (USD)</label>
            <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="w-full p-3 rounded-xl bg-secondary text-foreground text-xl font-bold outline-none border-0" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-medium mb-1.5 block">When</label>
            <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className="w-full p-3 rounded-xl bg-secondary text-foreground text-sm outline-none border-0" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Timezone</label>
            <input value={timezone} onChange={(e) => setTimezone(e.target.value)} className="w-full p-3 rounded-xl bg-secondary text-foreground text-sm outline-none border-0" />
            <p className="text-[10px] text-muted-foreground mt-1">Default detected: {localTz()}</p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Frequency</label>
            <div className="grid grid-cols-4 gap-2">
              {(["once", "weekly", "biweekly", "monthly"] as const).map((f) => (
                <button key={f} onClick={() => setFrequency(f)} className={`py-2 rounded-lg text-xs font-semibold ${frequency === f ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}>{f}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Memo</label>
            <input value={memo} onChange={(e) => setMemo(e.target.value)} className="w-full p-3 rounded-xl bg-secondary text-foreground text-sm outline-none border-0" />
          </div>

          <div className="text-[11px] text-muted-foreground bg-secondary/60 rounded-xl p-3">
            <strong className="text-foreground">Timing:</strong> {info.timing} · <strong className="text-foreground">Fee:</strong> {info.feeLabel}
            {info.cutoff && <> · {info.cutoff}</>}
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-secondary text-foreground text-sm font-semibold">Cancel</button>
            <button disabled={saving} onClick={save} className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60">
              {saving ? "Saving…" : initial ? "Update schedule" : "Schedule transfer"}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ScheduledTransfers;

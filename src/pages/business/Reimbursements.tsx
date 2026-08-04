import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Receipt, Loader2, Plus, Check, X } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import GlassCard from "@/components/glass/GlassCard";
import Seo from "@/components/Seo";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ledgerProvider, friendlyProviderMessage, type ProviderSnapshot } from "@/lib/ledgerProvider";
import {
  FilterShell,
  FilterChip,
  DateRangeField,
  AmountRangeField,
  inDateWindow,
  inAmountWindow,
} from "@/components/filters/FilterBar";
import { money } from "./BusinessHome";

interface Reimb {
  id: string;
  bank_account_id: string;
  requester_user_id: string;
  amount_cents: number;
  description: string;
  receipt_path: string | null;
  status: string;
  created_at: string;
}

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-secondary text-muted-foreground",
  approved: "bg-primary/10 text-primary",
  paid: "bg-success/10 text-success",
  denied: "bg-destructive/10 text-destructive",
};

const STATUS_FILTERS = ["All", "pending", "approved", "paid", "denied"];

/**
 * Team reimbursements. A member submits an expense with a receipt; an owner or
 * admin approves, which triggers a real book transfer into the requester's own
 * account (or is marked "approved" for manual payout when they have none).
 */
const Reimbursements = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<Reimb[] | null>(null);
  const [snap, setSnap] = useState<ProviderSnapshot | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");


  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    const [{ data, error }, s] = await Promise.all([
      supabase.from("reimbursements").select("*").order("created_at", { ascending: false }),
      ledgerProvider.sync({ limit: 1 }).catch(() => null),
    ]);
    if (error) toast.error(error.message);
    setRows((data ?? []) as Reimb[]);
    if (s) {
      setSnap(s);
      setAccountId((prev) => prev || s.accounts[0]?.id || "");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const submit = async () => {
    if (!user) return;
    const cents = Math.round(Number(amount) * 100);
    if (!accountId) return toast.error("Choose the account to be reimbursed from");
    if (!cents || cents <= 0) return toast.error("Enter an amount");
    if (description.trim().length < 3) return toast.error("Describe the expense");
    setBusy("submit");
    try {
      let receiptPath: string | null = null;
      if (file) {
        const path = `${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("receipts").upload(path, file);
        if (upErr) throw new Error(upErr.message);
        receiptPath = path;
      }
      const { error } = await supabase.from("reimbursements").insert({
        bank_account_id: accountId,
        requester_user_id: user.id,
        amount_cents: cents,
        description: description.trim(),
        receipt_path: receiptPath,
        status: "pending",
      });
      if (error) throw new Error(error.message);
      toast.success("Request submitted");
      setAmount(""); setDescription(""); setFile(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit");
    } finally { setBusy(null); }
  };

  const decide = async (r: Reimb, approve: boolean) => {
    setBusy(r.id);
    try {
      const res = await ledgerProvider.reimburseDecide(r.id, approve);
      toast.success(res.status === "paid" ? "Approved and paid" : `Request ${res.status}`, {
        description: res.reason ?? undefined,
      });
      await load();
    } catch (e) { toast.error(friendlyProviderMessage(e)); }
    finally { setBusy(null); }
  };

  const canManage = (r: Reimb) =>
    ["primary", "joint", "admin"].includes(
      snap?.accounts.find((a) => a.id === r.bank_account_id)?.myRole ?? "",
    ) && r.requester_user_id !== user?.id;

  const receipt = async (path: string) => {
    const { data } = await supabase.storage.from("receipts").createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
    else toast.error("Receipt unavailable");
  };

  return (
    <AppLayout>
      <Seo title="Reimbursements | Glass Bank" description="Submit and approve team expense reimbursements." path="/reimbursements" noindex />
      <div className="px-5 sm:px-6 lg:px-0 pt-10 sm:pt-12 space-y-5 pb-8">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-display font-bold text-foreground">Reimbursements</h1>
          <p className="text-sm text-muted-foreground mt-1">Submit an expense, or approve your team's.</p>
        </motion.div>

        <GlassCard className="space-y-3">
          <p className="text-sm font-semibold text-foreground">New request</p>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} aria-label="Account"
            className="w-full px-4 py-3 rounded-2xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
            {(snap?.accounts ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="0" step="0.01" placeholder="Amount"
            className="w-full px-4 py-3 rounded-2xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What was it for?"
            className="w-full px-4 py-3 rounded-2xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          <input type="file" accept="image/*,application/pdf" aria-label="Receipt"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-xs text-muted-foreground file:mr-3 file:px-3 file:py-2 file:rounded-xl file:border-0 file:bg-secondary file:text-foreground file:text-xs file:font-semibold" />
          <button onClick={submit} disabled={busy === "submit"}
            className="w-full min-h-12 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
            {busy === "submit" ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Submit request
          </button>
        </GlassCard>

        {!rows && <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" /></div>}
        {rows?.length === 0 && (
          <GlassCard className="text-center py-10">
            <Receipt className="mx-auto text-muted-foreground mb-2" />
            <p className="text-sm font-semibold text-foreground">No requests yet</p>
          </GlassCard>
        )}

        <div className="space-y-2">
          {(rows ?? []).map((r) => (
            <GlassCard key={r.id} className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{r.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString()}
                    {r.requester_user_id === user?.id ? " · your request" : " · teammate"}
                  </p>
                  {r.receipt_path && (
                    <button onClick={() => receipt(r.receipt_path!)} className="text-xs font-semibold text-primary mt-1">
                      View receipt
                    </button>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-foreground tabular-nums">{money(r.amount_cents / 100)}</p>
                  <span className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[r.status] ?? "bg-secondary"}`}>
                    {r.status}
                  </span>
                </div>
              </div>
              {r.status === "pending" && canManage(r) && (
                <div className="flex gap-2">
                  <button onClick={() => decide(r, true)} disabled={busy === r.id}
                    className="btn-full text-xs font-semibold px-3 py-2 rounded-xl bg-success/10 text-success flex items-center gap-1.5">
                    <Check size={13} /> Approve & pay
                  </button>
                  <button onClick={() => decide(r, false)} disabled={busy === r.id}
                    className="btn-full text-xs font-semibold px-3 py-2 rounded-xl bg-destructive/10 text-destructive flex items-center gap-1.5">
                    <X size={13} /> Deny
                  </button>
                </div>
              )}
            </GlassCard>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default Reimbursements;

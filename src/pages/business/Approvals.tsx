import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Loader2, ShieldCheck, Check, X, Clock, AlertTriangle, Save,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import GlassCard from "@/components/glass/GlassCard";
import Seo from "@/components/Seo";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  ledgerProvider, friendlyProviderMessage,
  type ApprovalOverview, type ProviderAccount,
} from "@/lib/ledgerProvider";
import { money } from "./BusinessHome";

const KIND_LABEL: Record<string, string> = {
  book: "Internal transfer",
  ach: "ACH payment",
  wire: "Wire payment",
  ach_pull: "ACH pull",
};

const STATUS_STYLE: Record<string, string> = {
  pending_approval: "bg-primary/10 text-primary",
  executed: "bg-success/10 text-success",
  denied: "bg-secondary text-muted-foreground",
  failed: "bg-destructive/10 text-destructive",
};

/**
 * Payment approvals.
 *
 * The threshold is enforced server-side in `ledger-sync` — this screen only
 * sets it and decides queued payments. An admin's payment over the limit is
 * parked before it ever reaches the banking partner.
 */
const Approvals = () => {
  const { user } = useAuth();
  const [data, setData] = useState<ApprovalOverview | null>(null);
  const [accounts, setAccounts] = useState<ProviderAccount[]>([]);
  const [thresholds, setThresholds] = useState<Record<string, string>>({});
  const [receiptMins, setReceiptMins] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [overview, snap] = await Promise.all([
        ledgerProvider.approvalsList(),
        ledgerProvider.sync({ limit: 1 }),
      ]);
      setData(overview);
      setAccounts(snap.accounts);
      const ids = snap.accounts.map((a) => a.id);
      const { data: settings } = await supabase
        .from("account_settings")
        .select("bank_account_id, approval_threshold_cents, receipt_required_cents")
        .in("bank_account_id", ids.length ? ids : ["none"]);
      const t: Record<string, string> = {};
      const r: Record<string, string> = {};
      for (const s of settings ?? []) {
        t[s.bank_account_id] = s.approval_threshold_cents === null || s.approval_threshold_cents === undefined
          ? "" : String(Number(s.approval_threshold_cents) / 100);
        r[s.bank_account_id] = s.receipt_required_cents === null || s.receipt_required_cents === undefined
          ? "" : String(Number(s.receipt_required_cents) / 100);
      }
      setThresholds(t);
      setReceiptMins(r);
      setError(null);
    } catch (e) {
      setError(friendlyProviderMessage(e));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const saveSettings = async (bankAccountId: string) => {
    if (!user) return;
    const raw = thresholds[bankAccountId];
    const rawReceipt = receiptMins[bankAccountId];
    const cents = raw === "" || raw === undefined ? null : Math.round(Number(raw) * 100);
    if (cents !== null && (!Number.isFinite(cents) || cents < 0)) return toast.error("Enter a valid amount");
    const receiptCents = rawReceipt === "" || rawReceipt === undefined
      ? 7500 : Math.round(Number(rawReceipt) * 100);
    setBusy(bankAccountId);
    const { error: err } = await supabase.from("account_settings").upsert({
      bank_account_id: bankAccountId,
      approval_threshold_cents: cents,
      receipt_required_cents: receiptCents,
      updated_by: user.id,
    }, { onConflict: "bank_account_id" });
    setBusy(null);
    if (err) return toast.error(err.message);
    toast.success(cents === null ? "Approvals turned off for this account" : "Approval limit saved");
    void load();
  };

  const decide = async (id: string, approve: boolean) => {
    setBusy(id);
    try {
      const res = await ledgerProvider.approvalDecide(id, approve);
      toast.success(res.status === "executed" ? "Payment approved and sent" : "Payment denied");
      await load();
    } catch (e) {
      toast.error(friendlyProviderMessage(e));
    } finally { setBusy(null); }
  };

  const pending = (data?.approvals ?? []).filter((a) => a.status === "pending_approval");
  const history = (data?.approvals ?? []).filter((a) => a.status !== "pending_approval").slice(0, 15);

  return (
    <AppLayout>
      <Seo title="Payment approvals | Glass Bank" description="Require sign-off on large business payments before they leave your account." path="/approvals" noindex />
      <div className="px-5 sm:px-6 lg:px-0 pt-10 sm:pt-12 space-y-5 pb-8">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-display font-bold text-foreground">Payment approvals</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Payments over your limit wait here for the account owner before any money moves.
          </p>
        </motion.div>

        {error && <GlassCard><p className="text-sm text-destructive">{error}</p></GlassCard>}
        {!data && !error && <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" /></div>}

        {data && (
          <>
            <h2 className="text-section-title px-1">Waiting for you</h2>
            {pending.length === 0 && (
              <GlassCard className="text-center py-8">
                <ShieldCheck className="mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-semibold text-foreground">Nothing waiting</p>
                <p className="text-xs text-muted-foreground mt-1">Payments above your limit will appear here.</p>
              </GlassCard>
            )}
            <div className="space-y-2">
              {pending.map((a) => {
                const mine = a.requestedByMe;
                const canDecide = data.canApprove.includes(a.bankAccountId) && !mine;
                return (
                  <GlassCard key={a.id} className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {a.description || KIND_LABEL[a.kind] || a.kind}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {KIND_LABEL[a.kind] ?? a.kind} · {a.accountName} ·{" "}
                          {new Date(a.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-foreground tabular-nums shrink-0">
                        {money(a.amountCents / 100)}
                      </p>
                    </div>
                    {canDecide ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => decide(a.id, true)} disabled={busy === a.id}
                          className="btn-full flex-1 min-h-11 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60"
                        >
                          {busy === a.id ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                          Approve &amp; send
                        </button>
                        <button
                          onClick={() => decide(a.id, false)} disabled={busy === a.id}
                          className="btn-full flex-1 min-h-11 rounded-2xl bg-secondary text-foreground text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60"
                        >
                          <X size={15} /> Deny
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Clock size={13} />
                        {mine
                          ? "You requested this — the account owner has to approve it."
                          : "Only the primary account owner can decide this."}
                      </p>
                    )}
                  </GlassCard>
                );
              })}
            </div>

            <h2 className="text-section-title px-1">Approval limits</h2>
            <div className="space-y-2">
              {accounts.filter((a) => a.myRole === "primary").length === 0 && (
                <GlassCard>
                  <p className="text-sm text-muted-foreground">
                    Only the primary owner of an account can set its approval limit.
                  </p>
                </GlassCard>
              )}
              {accounts.filter((a) => a.myRole === "primary").map((a) => (
                <GlassCard key={a.id} className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{a.name}</p>
                    <p className="text-xs text-muted-foreground">{a.accountNumber}</p>
                  </div>
                  <label className="block">
                    <span className="text-xs text-muted-foreground">
                      Require approval for payments over (leave blank for no approvals)
                    </span>
                    <input
                      value={thresholds[a.id] ?? ""}
                      onChange={(e) => setThresholds({ ...thresholds, [a.id]: e.target.value })}
                      type="number" min="0" step="0.01" placeholder="5000"
                      className="mt-1 w-full px-4 py-3 rounded-2xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-muted-foreground">Flag missing receipts over</span>
                    <input
                      value={receiptMins[a.id] ?? ""}
                      onChange={(e) => setReceiptMins({ ...receiptMins, [a.id]: e.target.value })}
                      type="number" min="0" step="0.01" placeholder="75"
                      className="mt-1 w-full px-4 py-3 rounded-2xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </label>
                  <button
                    onClick={() => saveSettings(a.id)} disabled={busy === a.id}
                    className="min-h-11 px-4 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60"
                  >
                    {busy === a.id ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save
                  </button>
                </GlassCard>
              ))}
            </div>

            <p className="text-xs text-muted-foreground flex items-start gap-1.5 px-1">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              Limits apply to team admins. As the primary owner your own payments always send immediately.
            </p>

            {history.length > 0 && (
              <>
                <h2 className="text-section-title px-1">Decided</h2>
                <div className="space-y-2">
                  {history.map((a) => (
                    <GlassCard key={a.id} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {a.description || KIND_LABEL[a.kind] || a.kind}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {a.decidedAt ? new Date(a.decidedAt).toLocaleString() : ""}
                          {a.error && ` · ${a.error}`}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-foreground tabular-nums">{money(a.amountCents / 100)}</p>
                        <span className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[a.status] ?? "bg-secondary"}`}>
                          {a.status.replace("_", " ")}
                        </span>
                      </div>
                    </GlassCard>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default Approvals;

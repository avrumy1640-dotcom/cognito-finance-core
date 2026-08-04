import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Loader2, Download, Receipt, AlertTriangle, ArrowRight, BookOpen,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import GlassCard from "@/components/glass/GlassCard";
import Seo from "@/components/Seo";
import { supabase } from "@/integrations/supabase/client";
import { ledgerProvider, friendlyProviderMessage, type ProviderSnapshot } from "@/lib/ledgerProvider";
import { buildCsv } from "@/lib/exports";
import { money } from "./BusinessHome";

const DEFAULT_RECEIPT_MIN_CENTS = 7500;

const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Bookkeeping: the two things a bookkeeper asks for — documentation for the
 * big spends, and a clean CSV of the period. Both read the real synced ledger.
 */
const Bookkeeping = () => {
  const navigate = useNavigate();
  const [snap, setSnap] = useState<ProviderSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receiptRefs, setReceiptRefs] = useState<Set<string>>(new Set());
  const [minCents, setMinCents] = useState(DEFAULT_RECEIPT_MIN_CENTS);

  const today = new Date();
  const [from, setFrom] = useState(iso(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [to, setTo] = useState(iso(today));

  const load = useCallback(async () => {
    try {
      const s = await ledgerProvider.sync({ limit: 500 });
      setSnap(s);
      const [{ data: receipts }, { data: settings }] = await Promise.all([
        supabase.from("transaction_receipts").select("transaction_ref"),
        supabase.from("account_settings").select("receipt_required_cents"),
      ]);
      setReceiptRefs(new Set((receipts ?? []).map((r) => r.transaction_ref)));
      const configured = (settings ?? [])
        .map((r) => Number(r.receipt_required_cents))
        .filter((n) => Number.isFinite(n) && n > 0);
      if (configured.length) setMinCents(Math.min(...configured));
      setError(null);
    } catch (e) {
      setError(friendlyProviderMessage(e));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const txs = snap?.transactions ?? [];

  const missing = useMemo(
    () => txs.filter((t) => t.amount < 0 && Math.abs(t.amount) * 100 >= minCents && !receiptRefs.has(t.id)),
    [txs, minCents, receiptRefs],
  );

  const inRange = useMemo(() => {
    const start = new Date(`${from}T00:00:00`);
    const end = new Date(`${to}T23:59:59`);
    return txs.filter((t) => {
      const d = new Date(t.date);
      return !Number.isNaN(d.getTime()) && d >= start && d <= end;
    });
  }, [txs, from, to]);

  const accountName = useCallback(
    (id: string) => snap?.accounts.find((a) => a.id === id)?.name ?? id,
    [snap],
  );

  const exportCsv = () => {
    if (!inRange.length) return toast.error("No transactions in that date range");
    const headers = ["Date", "Description", "Amount", "Category", "Account", "Reference"];
    const rows = inRange.map((t) => ({
      Date: new Date(t.date).toISOString().slice(0, 10),
      Description: t.merchant,
      Amount: t.amount.toFixed(2),
      Category: t.category || "Uncategorized",
      Account: accountName(t.account),
      Reference: t.id,
    }));
    const res = buildCsv("glassbank-transactions", headers, rows);
    res.download();
    toast.success(`Exported ${res.rows} transactions`, { description: res.confirmationCode });
  };

  return (
    <AppLayout>
      <Seo title="Bookkeeping | Glass Bank" description="Track missing receipts and export business transactions for your accountant." path="/bookkeeping" noindex />
      <div className="px-5 sm:px-6 lg:px-0 pt-10 sm:pt-12 space-y-5 pb-8">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-display font-bold text-foreground">Bookkeeping</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Keep receipts attached and hand your accountant a clean file.
          </p>
        </motion.div>

        {error && <GlassCard><p className="text-sm text-destructive">{error}</p></GlassCard>}
        {!snap && !error && <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" /></div>}

        {snap && (
          <>
            <GlassCard className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Export for accounting</p>
                <BookOpen size={16} className="text-primary" />
              </div>
              <p className="text-xs text-muted-foreground">
                CSV with date, description, amount, category, account and reference — the shape
                QuickBooks and Xero import.
              </p>
              <div className="flex gap-2">
                <label className="flex-1">
                  <span className="text-xs text-muted-foreground">From</span>
                  <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                    className="mt-1 w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                </label>
                <label className="flex-1">
                  <span className="text-xs text-muted-foreground">To</span>
                  <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
                    className="mt-1 w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                </label>
              </div>
              <button onClick={exportCsv}
                className="min-h-11 px-4 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2">
                <Download size={16} /> Export {inRange.length} transaction{inRange.length === 1 ? "" : "s"}
              </button>
            </GlassCard>

            <div className="flex items-center justify-between px-1">
              <h2 className="text-section-title">Missing receipts</h2>
              <span className="text-xs text-muted-foreground">over {money(minCents / 100)}</span>
            </div>

            {missing.length === 0 ? (
              <GlassCard className="text-center py-8">
                <Receipt className="mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-semibold text-foreground">Everything is documented</p>
                <p className="text-xs text-muted-foreground mt-1">
                  No payments above {money(minCents / 100)} are missing a receipt.
                </p>
              </GlassCard>
            ) : (
              <>
                <p className="text-xs text-muted-foreground flex items-start gap-1.5 px-1">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0 text-destructive" />
                  {missing.length} payment{missing.length === 1 ? "" : "s"} still need documentation.
                  Open one to attach a photo or PDF.
                </p>
                <div className="space-y-2">
                  {missing.map((t) => (
                    <GlassCard key={t.id} className="p-0 overflow-hidden">
                      <button
                        onClick={() => navigate(`/transaction/${t.id}`)}
                        className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-secondary/50 transition-colors"
                      >
                        <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                          <Receipt size={16} className="text-destructive" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">{t.merchant}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(t.date).toLocaleDateString()} · {accountName(t.account)}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-foreground tabular-nums">{money(t.amount)}</p>
                        <ArrowRight size={15} className="text-muted-foreground shrink-0" />
                      </button>
                    </GlassCard>
                  ))}
                </div>
              </>
            )}

            <p className="text-xs text-muted-foreground px-1">
              Change the receipt threshold per account under Approvals.
            </p>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default Bookkeeping;

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, CartesianGrid, Cell,
} from "recharts";
import {
  Plus, Loader2, Landmark, Send, FileText, Receipt, Users, ArrowRight, Eye,
  TrendingDown, TrendingUp, ShieldCheck, BookOpen, ArrowDownLeft, ArrowUpRight,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import GlassCard from "@/components/glass/GlassCard";
import Seo from "@/components/Seo";
import { ledgerProvider, friendlyProviderMessage, type ProviderSnapshot } from "@/lib/ledgerProvider";
import { useBusiness } from "@/hooks/useBusiness";
import { supabase } from "@/integrations/supabase/client";
import { cashFlowSummary, topCategoriesThisMonth, type FlowTx } from "@/lib/businessMetrics";

export const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const compact = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });

const quickLinks = [
  { to: "/payments", label: "Payments", desc: "Pay vendors and move funds", icon: Send },
  { to: "/bills", label: "Bills to pay", desc: "What you owe, and when", icon: Receipt },
  { to: "/invoices", label: "Invoices", desc: "Bill clients, track payment", icon: FileText },
  { to: "/approvals", label: "Approvals", desc: "Sign off on large payments", icon: ShieldCheck },
  { to: "/bookkeeping", label: "Bookkeeping", desc: "Receipts and CSV export", icon: BookOpen },
  { to: "/team", label: "Team", desc: "Admins and view-only access", icon: Users },
];

/**
 * Business overview.
 *
 * Opens on cash flow — money in vs out, burn and runway — because that is the
 * question a founder actually opens a banking app to answer. Every figure is
 * computed from transactions the banking partner reported; nothing is
 * projected or invented, and anything we can't answer honestly shows "—".
 */
const BusinessHome = () => {
  const navigate = useNavigate();
  const { businessName } = useBusiness();
  const [snap, setSnap] = useState<ProviderSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [owed, setOwed] = useState<{ payable: number; receivable: number } | null>(null);

  const load = useCallback(async () => {
    try {
      // A wide window so the six-month trend is built from real history.
      setSnap(await ledgerProvider.sync({ limit: 500 }));
      setError(null);
    } catch (e) {
      setError(friendlyProviderMessage(e));
    }
  }, []);

  const loadOwed = useCallback(async () => {
    const [bills, invoices] = await Promise.all([
      supabase.from("bills").select("amount_cents").in("status", ["unpaid", "scheduled"]),
      supabase.from("invoices").select("amount_cents").in("status", ["sent", "overdue"]),
    ]);
    setOwed({
      payable: (bills.data ?? []).reduce((s, r) => s + Number(r.amount_cents), 0) / 100,
      receivable: (invoices.data ?? []).reduce((s, r) => s + Number(r.amount_cents), 0) / 100,
    });
  }, []);

  useEffect(() => { void load(); void loadOwed(); }, [load, loadOwed]);

  const create = async () => {
    if (name.trim().length < 2) return toast.error("Give the account a name");
    setBusy(true);
    try {
      const res = await ledgerProvider.subAccountCreate(name.trim());
      setSnap(res.snapshot);
      setName("");
      setCreating(false);
      toast.success(`${res.name} is open`);
    } catch (e) {
      toast.error(friendlyProviderMessage(e));
    } finally { setBusy(false); }
  };

  const accounts = snap?.accounts ?? [];
  const total = accounts.reduce((s, a) => s + (a.available ?? 0), 0);

  const txs = useMemo<FlowTx[]>(
    () => (snap?.transactions ?? []).map((t) => ({
      id: t.id, merchant: t.merchant, category: t.category,
      amount: t.amount, date: t.date, status: t.status,
    })),
    [snap],
  );

  const flow = useMemo(() => cashFlowSummary(txs, total), [txs, total]);
  const categories = useMemo(() => topCategoriesThisMonth(txs), [txs]);
  const chart = flow.months.map((m) => ({ ...m, netAbs: m.net }));
  const categoryMax = categories[0]?.total ?? 0;

  return (
    <AppLayout>
      <Seo title="Business overview | Glass Bank" description="Cash flow, balances and money movement for your business in one place." path="/business" noindex />
      <div className="px-5 sm:px-6 lg:px-0 pt-10 sm:pt-12 space-y-5 pb-8">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <p className="kicker text-primary">{businessName}</p>
          <h1 className="text-2xl font-display font-bold text-foreground">Business overview</h1>
        </motion.div>

        <GlassCard elevated className="p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Total available</p>
          <p className="text-4xl font-display font-bold text-foreground mt-1 tabular-nums">
            {snap ? money(total) : "—"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Across {accounts.length} account{accounts.length === 1 ? "" : "s"}
          </p>
          {owed && (
            <div className="mt-4 pt-4 border-t border-border flex items-center gap-4 text-sm">
              <button onClick={() => navigate("/bills")} className="flex-1 text-left">
                <p className="text-xs text-muted-foreground">You owe</p>
                <p className="font-semibold text-foreground tabular-nums">{money(owed.payable)}</p>
              </button>
              <div className="w-px self-stretch bg-border" />
              <button onClick={() => navigate("/invoices")} className="flex-1 text-left">
                <p className="text-xs text-muted-foreground">You're owed</p>
                <p className="font-semibold text-foreground tabular-nums">{money(owed.receivable)}</p>
              </button>
            </div>
          )}
        </GlassCard>

        {/* ---------------- Cash flow ---------------- */}
        <div className="flex items-center justify-between px-1">
          <h2 className="text-section-title">Cash flow</h2>
          <span className="text-xs text-muted-foreground">This month</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <GlassCard className="py-4">
            <div className="flex items-center gap-1.5 text-success">
              <ArrowDownLeft size={14} />
              <p className="text-xs font-semibold uppercase tracking-wider">Money in</p>
            </div>
            <p className="text-xl font-display font-bold text-foreground mt-1 tabular-nums">
              {snap ? money(flow.thisMonth.in) : "—"}
            </p>
          </GlassCard>
          <GlassCard className="py-4">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <ArrowUpRight size={14} />
              <p className="text-xs font-semibold uppercase tracking-wider">Money out</p>
            </div>
            <p className="text-xl font-display font-bold text-foreground mt-1 tabular-nums">
              {snap ? money(flow.thisMonth.out) : "—"}
            </p>
          </GlassCard>
        </div>

        <GlassCard className="space-y-3">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-semibold text-foreground">Last 6 months</p>
            <p className={`text-sm font-semibold tabular-nums ${flow.thisMonth.net >= 0 ? "text-success" : "text-foreground"}`}>
              {snap ? `${flow.thisMonth.net >= 0 ? "+" : "−"}${money(Math.abs(flow.thisMonth.net))}` : "—"}
              <span className="text-xs font-normal text-muted-foreground"> net this month</span>
            </p>
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tickLine={false} axisLine={false}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  cursor={{ fill: "hsl(var(--secondary))" }}
                  contentStyle={{
                    background: "hsl(var(--card))", border: "1px solid hsl(var(--border))",
                    borderRadius: 12, fontSize: 12,
                  }}
                  formatter={(v: number) => [money(v), "Net"]}
                />
                <Bar dataKey="netAbs" radius={[6, 6, 6, 6]}>
                  {chart.map((m) => (
                    <Cell key={m.key} fill={m.net >= 0 ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Bars show money in minus money out for each month, from settled activity on your accounts.
          </p>
        </GlassCard>

        <div className="grid grid-cols-2 gap-3">
          <GlassCard className="py-4">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              {flow.burn ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
              <p className="text-xs font-semibold uppercase tracking-wider">Net burn</p>
            </div>
            <p className="text-xl font-display font-bold text-foreground mt-1 tabular-nums">
              {flow.burn ? `${money(flow.burn)}/mo` : "—"}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {flow.burn
                ? `Average across ${flow.historyMonths} full month${flow.historyMonths === 1 ? "" : "s"}`
                : flow.historyMonths < 2
                  ? "Needs 2 full months of history"
                  : "You're cash-flow positive"}
            </p>
          </GlassCard>
          <GlassCard className="py-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Runway</p>
            <p className="text-xl font-display font-bold text-foreground mt-1 tabular-nums">
              {flow.runwayMonths ? `${flow.runwayMonths.toFixed(1)} mo` : "—"}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {flow.runwayMonths
                ? `${compact(total)} at ${compact(flow.burn ?? 0)}/mo`
                : "Shown only while burning cash"}
            </p>
          </GlassCard>
        </div>

        {categories.length > 0 && (
          <GlassCard className="space-y-3">
            <p className="text-sm font-semibold text-foreground">Top spending this month</p>
            <div className="space-y-2.5">
              {categories.map((c) => (
                <div key={c.category}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-foreground font-medium">{c.category}</span>
                    <span className="text-muted-foreground tabular-nums">{money(c.total)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full rounded-full bg-primary"
                      style={{ width: `${categoryMax ? Math.max(4, (c.total / categoryMax) * 100) : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        )}

        {/* ---------------- Shortcuts ---------------- */}
        <h2 className="text-section-title px-1">Run the business</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {quickLinks.map((q) => (
            <button key={q.to} onClick={() => navigate(q.to)} className="text-left">
              <GlassCard className="h-full flex flex-col gap-3 py-4">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                  <q.icon size={22} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{q.label}</p>
                  <p className="text-xs text-muted-foreground leading-tight mt-0.5">{q.desc}</p>
                </div>
              </GlassCard>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between px-1">
          <h2 className="text-section-title">Accounts</h2>
          <button
            onClick={() => setCreating((v) => !v)}
            className="text-xs font-semibold text-primary flex items-center gap-1"
          >
            <Plus size={14} /> New account
          </button>
        </div>

        {creating && (
          <GlassCard className="space-y-3">
            <p className="text-sm font-semibold text-foreground">Open a named account</p>
            <p className="text-xs text-muted-foreground">
              Real, separately numbered accounts — use them for Payroll, Taxes or Operating funds.
            </p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create()}
              placeholder="Payroll"
              className="w-full px-4 py-3 rounded-2xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              onClick={create}
              disabled={busy}
              className="w-full min-h-11 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Open account
            </button>
          </GlassCard>
        )}

        {error && <GlassCard><p className="text-sm text-destructive">{error}</p></GlassCard>}

        {!snap && !error && (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" /></div>
        )}

        <div className="space-y-2">
          {accounts.map((a) => (
            <GlassCard key={a.id} className="p-0 overflow-hidden">
              <button
                onClick={() => navigate(`/account/${a.id}`)}
                className="w-full flex items-center gap-3 px-4 py-4 text-left active:bg-secondary/50 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Landmark size={20} className="text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{a.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.accountNumber} · {a.status}
                    {a.myRole === "viewer" && " · view only"}
                    {a.myRole === "admin" && " · admin"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-foreground tabular-nums">{money(a.available)}</p>
                  {a.pending > 0 && (
                    <p className="text-[11px] text-muted-foreground tabular-nums">{money(a.pending)} pending</p>
                  )}
                </div>
                <ArrowRight size={16} className="text-muted-foreground shrink-0" />
              </button>
            </GlassCard>
          ))}
        </div>

        {snap && accounts.some((a) => a.myRole === "viewer") && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 px-1">
            <Eye size={13} /> View-only accounts can't be used to send money.
          </p>
        )}
      </div>
    </AppLayout>
  );
};

export default BusinessHome;

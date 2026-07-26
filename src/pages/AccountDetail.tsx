import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import GlassCard from "@/components/glass/GlassCard";
import { useBank } from "@/store/bankStore";
import DataErrorState from "@/components/layout/DataErrorState";
import { useKyc } from "@/hooks/useKyc";
import { toast } from "sonner";
import { generateMonthlyStatement } from "@/lib/pdfDocuments";
import { buildPdf, type ExportResult } from "@/lib/exports";
import ExportPreviewModal from "@/components/exports/ExportPreviewModal";
import {
  ArrowLeft,
  Copy,
  Search,
  ChevronRight,
  Settings,
  FileText,
  Edit3,
  Shield,
  ShieldCheck,
  TrendingUp,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Send,
  QrCode,
  Inbox,
  X,
} from "lucide-react";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const parseTxDate = (raw: string): Date | null => {
  if (!raw) return null;
  if (/^today/i.test(raw)) return new Date();
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
};

type TxFilter = "all" | "in" | "out" | "pending";

const AccountDetail = () => {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"transactions" | "details" | "limits" | "statements" | "settings">("transactions");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<TxFilter>("all");
  const [limitsExport, setLimitsExport] = useState<ExportResult | null>(null);
  const { accounts, transactions, dataStatus, dataError, retry } = useBank(); const loading = false;
  const { status: kycStatus } = useKyc();
  const account = type === "savings" ? accounts.savings : accounts.checking;

  const acctTransactions = useMemo(() => {
    const label = type === "savings" ? "Savings" : "Checking";
    return transactions
      .filter((t) => t.account === label)
      .filter((t) => {
        if (filter === "in") return t.amount > 0;
        if (filter === "out") return t.amount < 0;
        if (filter === "pending") return t.status === "pending";
        return true;
      })
      .filter((t) => !search || t.merchant.toLowerCase().includes(search.toLowerCase()) || t.category?.toLowerCase().includes(search.toLowerCase()));
  }, [transactions, type, filter, search]);

  const copy = async (text: string, label: string) => {
    try { await navigator.clipboard.writeText(text); toast.success(`${label} copied`); } catch { toast.error("Copy failed"); }
  };

  const formatCurrency = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD" });

  const isSavings = type === "savings";
  const kicker = isSavings ? "Savings account" : "Everyday account";

  // Sensible default limits, presented as trust cues.
  const limits = isSavings
    ? [
        { label: "Daily transfer out", used: 500, cap: 25_000 },
        { label: "Monthly withdrawals", used: 2, cap: 6, unit: "count" as const },
      ]
    : [
        { label: "Daily ACH transfer", used: 1_240, cap: 25_000 },
        { label: "Daily card spend", used: 386.42, cap: 10_000 },
        { label: "Daily ATM withdrawal", used: 0, cap: 1_000 },
        { label: "Wire transfer (daily)", used: 0, cap: 100_000 },
      ];

  const filterChips: { key: TxFilter; label: string; icon?: typeof ArrowDownLeft }[] = [
    { key: "all", label: "All" },
    { key: "in", label: "Money in", icon: ArrowDownLeft },
    { key: "out", label: "Money out", icon: ArrowUpRight },
    { key: "pending", label: "Pending" },
  ];

  if (dataStatus === "error") {
    return (
      <div className="min-h-screen bg-background px-5 pt-14">
        <DataErrorState message={dataError} onRetry={retry} />
      </div>
    );
  }

  if (dataStatus === "loading") {
    return (
      <div className="min-h-screen bg-background px-5 pt-14 space-y-4">
        <div className="h-6 w-40 rounded-lg bg-secondary animate-pulse" />
        <div className="h-36 w-full rounded-3xl bg-secondary animate-pulse" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 w-full rounded-2xl bg-secondary animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="px-5 pt-14 space-y-5 pb-12">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center active:scale-95 transition-transform" aria-label="Back">
            <ArrowLeft size={20} className="text-foreground" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-primary uppercase tracking-widest">{kicker}</p>
            <h1 className="text-[22px] font-display font-bold text-foreground leading-tight tracking-tight truncate">{account.name}</h1>
          </div>
          <div className={`w-10 h-10 rounded-xl ${isSavings ? "gradient-savings" : "gradient-hero"} flex items-center justify-center shadow-lg shadow-primary/20`}>
            {isSavings ? <TrendingUp size={18} className="text-primary-foreground" /> : <Wallet size={18} className="text-primary-foreground" />}
          </div>
        </div>

        {/* Balance hero — mirrors onboarding hero language */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <GlassCard elevated className="relative overflow-hidden">
            <div className="absolute inset-0 gradient-hero opacity-[0.08] rounded-2xl" />
            <div className="relative">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-semibold text-primary uppercase tracking-widest">Available balance</span>
                {isSavings && "apy" in account && (
                  <span className="text-[10px] font-medium text-success bg-success/10 px-2 py-0.5 rounded-full">{(account as any).apy}% APY</span>
                )}
              </div>
              <p className="text-balance-display text-4xl text-foreground mt-1">{formatCurrency(account.availableBalance)}</p>
              <div className="flex gap-5 mt-3 flex-wrap">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Current</p>
                  <p className="text-sm font-semibold text-foreground">{formatCurrency(account.currentBalance)}</p>
                </div>
                {account.pendingAmount > 0 && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Pending</p>
                    <p className="text-sm font-semibold text-warning">{formatCurrency(account.pendingAmount)}</p>
                  </div>
                )}
                {isSavings && "interestEarned" in account && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Interest</p>
                    <p className="text-sm font-semibold text-success">{formatCurrency((account as any).interestEarned || 0)}</p>
                  </div>
                )}
              </div>
              {kycStatus === "verified" && (
                <div className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-medium text-success bg-success/10 rounded-full px-2.5 py-1">
                  <ShieldCheck size={12} /> FDIC insured up to $250,000
                </div>
              )}
            </div>
          </GlassCard>
        </motion.div>

        {/* Quick actions row */}
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => navigate("/move-money/send")} className="rounded-2xl bg-secondary p-3 flex flex-col items-center gap-1 active:scale-95 transition-transform">
            <Send size={18} className="text-primary" />
            <span className="text-[11px] font-medium text-foreground">Send</span>
          </button>
          <button onClick={() => navigate("/receive")} className="rounded-2xl bg-secondary p-3 flex flex-col items-center gap-1 active:scale-95 transition-transform">
            <QrCode size={18} className="text-primary" />
            <span className="text-[11px] font-medium text-foreground">Receive</span>
          </button>
          <button onClick={() => navigate("/move-money/transfer")} className="rounded-2xl bg-secondary p-3 flex flex-col items-center gap-1 active:scale-95 transition-transform">
            <ArrowUpRight size={18} className="text-primary" />
            <span className="text-[11px] font-medium text-foreground">Transfer</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-secondary rounded-xl p-1 overflow-x-auto [no-scrollbar::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {(["transactions", "details", "limits", "statements", "settings"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 min-w-[68px] py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                activeTab === tab ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === "transactions" && (
            <motion.div key="tx" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="relative mb-3">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search merchant, category…" className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-secondary text-foreground text-sm border-2 border-transparent outline-none focus:border-primary/40 focus:bg-card transition-colors" />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1" aria-label="Clear">
                    <X size={14} className="text-muted-foreground" />
                  </button>
                )}
              </div>
              <div className="flex gap-2 mb-3 overflow-x-auto [no-scrollbar::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {filterChips.map((chip) => {
                  const active = filter === chip.key;
                  return (
                    <button
                      key={chip.key}
                      onClick={() => setFilter(chip.key)}
                      className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                        active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {chip.icon && <chip.icon size={12} />}
                      {chip.label}
                    </button>
                  );
                })}
              </div>

              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-2xl bg-secondary/60 h-14 animate-pulse" />
                  ))}
                </div>
              ) : acctTransactions.length === 0 ? (
                <GlassCard className="py-10 flex flex-col items-center gap-3 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center">
                    <Inbox size={20} className="text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {search || filter !== "all" ? "No matches" : "No transactions yet"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
                      {search || filter !== "all"
                        ? "Try a different filter or clear your search."
                        : "Your recent activity will appear here as soon as money moves."}
                    </p>
                  </div>
                  {(search || filter !== "all") && (
                    <button onClick={() => { setSearch(""); setFilter("all"); }} className="text-xs font-semibold text-primary">
                      Clear filters
                    </button>
                  )}
                </GlassCard>
              ) : (
                <GlassCard className="divide-y divide-border p-0 overflow-hidden">
                  {acctTransactions.map((tx) => (
                    <button key={tx.id} onClick={() => navigate(`/transaction/${tx.id}`)} className="flex items-center justify-between w-full px-4 py-3 active:bg-secondary/50 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-lg w-7 shrink-0">{tx.icon}</span>
                        <div className="text-left min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{tx.merchant}</p>
                          <p className="text-xs text-muted-foreground truncate">{tx.category} · {tx.date}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <p className={`text-sm font-semibold ${tx.amount > 0 ? "text-success" : "text-foreground"}`}>
                          {tx.amount > 0 ? "+" : ""}${Math.abs(tx.amount).toFixed(2)}
                        </p>
                        {tx.status === "pending" && (
                          <span className="text-[10px] text-warning font-medium">Pending</span>
                        )}
                      </div>
                    </button>
                  ))}
                </GlassCard>
              )}
            </motion.div>
          )}

          {activeTab === "details" && (
            <motion.div key="details" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <GlassCard className="space-y-3">
                {[
                  { label: "Account Nickname", value: account.name },
                  { label: "Account Number", value: account.accountNumber },
                  { label: "Routing Number", value: account.routingNumber },
                  { label: "Account Status", value: "Active" },
                  { label: "Opened", value: account.openedDate },
                  { label: "Account Type", value: isSavings ? "High Yield Savings" : "Checking" },
                ].map((row) => (
                  <button
                    key={row.label}
                    onClick={() => row.label.includes("Number") ? copy(row.value, row.label) : undefined}
                    className="flex items-center justify-between w-full active:opacity-70"
                  >
                    <span className="text-sm text-muted-foreground">{row.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{row.value}</span>
                      {row.label.includes("Number") && <Copy size={14} className="text-muted-foreground" />}
                    </div>
                  </button>
                ))}
              </GlassCard>
            </motion.div>
          )}

          {activeTab === "limits" && (
            <motion.div key="limits" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
              <GlassCard className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Shield size={18} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Your limits</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Regulated caps that protect your account. Contact support to request temporary increases.</p>
                </div>
              </GlassCard>
              <div className="space-y-2">
                {limits.map((l) => {
                  const pct = Math.min(100, Math.round((l.used / l.cap) * 100));
                  const isCount = "unit" in l && l.unit === "count";
                  return (
                    <GlassCard key={l.label}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-foreground">{l.label}</span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {isCount ? l.used : formatCurrency(l.used)} / {isCount ? l.cap : formatCurrency(l.cap)}
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }} className={`h-full rounded-full ${pct > 80 ? "bg-warning" : "gradient-hero"}`} />
                      </div>
                    </GlassCard>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <button onClick={() => navigate("/support")} className="flex-1 py-3 rounded-2xl bg-secondary text-sm font-semibold text-foreground active:scale-[0.99] transition-transform">
                  Request an increase
                </button>
                <button
                  onClick={() => {
                    const headers = ["Limit", "Used", "Cap", "Utilization"];
                    const rows = limits.map((l) => ({
                      Limit: l.label,
                      Used: "unit" in l && l.unit === "count" ? String(l.used) : formatCurrency(l.used),
                      Cap: "unit" in l && l.unit === "count" ? String(l.cap) : formatCurrency(l.cap),
                      Utilization: `${Math.min(100, Math.round((l.used / l.cap) * 100))}%`,
                    }));
                    const result = buildPdf(
                      `limits-${type}`,
                      `${account.name} — Limits report`,
                      `Generated ${new Date().toLocaleDateString()} · Account ${account.accountNumber}`,
                      headers,
                      rows,
                    );
                    setLimitsExport(result);
                  }}
                  className="flex-1 py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold active:scale-[0.99] transition-transform"
                >
                  Export report
                </button>
              </div>
            </motion.div>
          )}

          {activeTab === "statements" && (
            <motion.div key="statements" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-2">
              {Array.from({ length: 12 }).map((_, i) => {
                const d = new Date();
                d.setDate(1);
                d.setMonth(d.getMonth() - i - 1);
                const label = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
                const periodStart = new Date(d.getFullYear(), d.getMonth(), 1);
                const periodEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
                return (
                  <GlassCard
                    key={label}
                    onClick={() => {
                      const accountLabel = isSavings ? "Savings" : "Checking";
                      const txs = transactions.filter((t) => {
                        if (t.account !== accountLabel) return false;
                        const dt = parseTxDate(t.date);
                        if (!dt) return i === 0;
                        return dt >= periodStart && dt <= periodEnd;
                      });
                      generateMonthlyStatement({
                        account,
                        transactions: txs,
                        periodLabel: label,
                        periodStart,
                        periodEnd,
                      });
                      toast.success(`Downloaded ${label} statement`);
                    }}
                    className="flex items-center justify-between py-3"
                  >
                    <div className="flex items-center gap-3">
                      <FileText size={18} className="text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">{label}</span>
                    </div>
                    <ChevronRight size={16} className="text-muted-foreground" />
                  </GlassCard>
                );
              })}
            </motion.div>
          )}

          {activeTab === "settings" && (
            <motion.div key="settings" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-2">
              {[
                {
                  icon: Edit3,
                  label: "Rename Account",
                  action: () => {
                    const next = prompt("Rename account", account.name);
                    if (next && next.trim()) toast.success(`Renamed to "${next.trim()}"`);
                  },
                },
                {
                  icon: Shield,
                  label: "Overdraft Preferences",
                  action: () => toast.success("Overdraft protection is ON", { description: "Linked to savings for coverage up to $500" }),
                },
                {
                  icon: Settings,
                  label: "Account Alerts",
                  action: () => navigate("/notifications/settings"),
                },
              ].map((item) => (
                <GlassCard
                  key={item.label}
                  onClick={item.action}
                  className="flex items-center justify-between py-3 cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <item.icon size={18} className="text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">{item.label}</span>
                  </div>
                  <ChevronRight size={16} className="text-muted-foreground" />
                </GlassCard>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <ExportPreviewModal result={limitsExport} onClose={() => setLimitsExport(null)} />
    </div>
  );
};

export default AccountDetail;

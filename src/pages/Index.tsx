import { formatTxDate, txGroupLabel } from "@/lib/dates";
import { Bell, Search, Eye, EyeOff, ShieldCheck, Clock, AlertCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import AppLayout from "@/components/layout/AppLayout";
import GlassCard from "@/components/glass/GlassCard";
import { useBank } from "@/store/bankStore";
import { useUnreadCount } from "@/hooks/useNotifications";
import DataErrorState from "@/components/layout/DataErrorState";
import { useKyc } from "@/hooks/useKyc";
import { useProfile } from "@/hooks/useProfile";
import { useBusiness } from "@/hooks/useBusiness";
import Seo from "@/components/Seo";
import {
  ArrowUpRight,
  ArrowDownLeft,
  QrCode,
  Send,
  ArrowLeftRight,
  Plus,
  CreditCard,
  Copy,
  Share2,
  ChevronRight,
  Zap,
  TrendingUp,
  Wallet,
  Shield,
} from "lucide-react";

const quickActions = [
  { label: "Send", icon: Send, path: "/move-money/send" },
  { label: "Add Money", icon: Plus, path: "/move-money/add" },
  { label: "Receive", icon: QrCode, path: "/receive" },
  { label: "Transfer", icon: ArrowLeftRight, path: "/move-money/transfer" },
  { label: "Cards", icon: CreditCard, path: "/cards" },
];

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
  }),
};

const Skeleton = ({ className = "" }: { className?: string }) => (
  <div className={`animate-pulse rounded-md bg-secondary/70 ${className}`} />
);

const HomePage = () => {
  const { isBusiness, loading: businessLoading } = useBusiness();
  const [balanceVisible, setBalanceVisible] = useState(true);
  const navigate = useNavigate();
  const { accounts, totalBalance, transactions, dataStatus, dataError, retry, payroll } = useBank();
  const checking = accounts.checking;
  const savings = accounts.savings;
  const unread = useUnreadCount();
  const { status: kycStatus, loading: kycLoading } = useKyc();
  const { displayName, loading: profileLoading } = useProfile();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // First-load skeleton: show while account data is still loading.
  // `idle` means we haven't even started (auth still resolving). `loading`
  // means the first sync is in flight. Both should render skeletons instead
  // of the fallback seed numbers.
  const hydrating = dataStatus === "loading";

  const formatCurrency = (n: number | null | undefined) =>
    n === null || n === undefined
      ? "—"
      :
    balanceVisible
      ? n.toLocaleString("en-US", { style: "currency", currency: "USD" })
      : "••••••";

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Copy failed");
    }
  };

  const shareDirectDeposit = async () => {
    const details = checking?.depositDetails;
    const acct = details?.accountNumber || checking?.accountNumber;
    const route = details?.iban || checking?.routingNumber;
    const routeLabel = details?.iban ? "IBAN" : "Routing";
    const text = `Glass Bank Deposit\n${routeLabel}: ${route}\nAccount: ${acct}${
      details?.reference ? `\nReference: ${details.reference}` : ""
    }`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Deposit info", text });
        return;
      } catch { /* canceled */ }
    }
    copyToClipboard(text, "Deposit info");
  };

  // Real cash-flow numbers derived from actual transactions this month.
  // Falls back cleanly to $0 when there's no activity yet.
  const cashFlow = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    let inSum = 0;
    let outSum = 0;
    for (const tx of transactions) {
      const t = new Date(tx.date).getTime();
      if (Number.isNaN(t) || t < startOfMonth) continue;
      if (tx.status !== "posted") continue;
      if (tx.amount > 0) inSum += tx.amount;
      else outSum += Math.abs(tx.amount);
    }
    return { moneyIn: inSum, moneyOut: outSum, net: inSum - outSum };
  }, [transactions]);

  const kycMeta = (() => {
    if (kycLoading) return null;
    if (kycStatus === "verified")
      return { icon: ShieldCheck, tint: "text-success", bg: "bg-success/10", label: "Identity verified", hint: "Bank-grade protection is active." };
    if (kycStatus === "pending")
      return { icon: Clock, tint: "text-warning", bg: "bg-warning/10", label: "Verification in review", hint: "You can browse — money movement unlocks once we're done." };
    if (kycStatus === "rejected")
      return { icon: AlertCircle, tint: "text-destructive", bg: "bg-destructive/10", label: "Verification needs attention", hint: "Update your details to unlock transfers." };
    return { icon: ShieldCheck, tint: "text-primary", bg: "bg-primary/10", label: "Verify to unlock transfers", hint: "Takes 2 minutes. Required by banking regulations." };
  })();

  return (
    <AppLayout>
      <Seo
        title="Dashboard — Glass Bank"
        description="Your Glass Bank dashboard: balances, recent activity, cash flow, and quick actions for transfers and cards."
        path="/"
        noindex
      />
      <div className="px-5 sm:px-6 lg:px-0 pt-10 sm:pt-12 lg:pt-10 space-y-5">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-primary uppercase tracking-widest mb-1">{greeting}</p>
            {profileLoading ? (
              <Skeleton className="h-7 w-40" />
            ) : (
              <h1 className="text-[26px] font-display font-bold tracking-tight text-foreground leading-tight truncate">
                Dashboard — {displayName || "there"}
              </h1>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/activity")}
              className="h-11 w-11 rounded-full bg-secondary flex items-center justify-center active:scale-95 transition-transform"
              aria-label="Search"
            >
              <Search size={18} className="text-muted-foreground" />
            </button>
            <button
              onClick={() => navigate("/notifications")}
              className="relative h-11 w-11 rounded-full bg-secondary flex items-center justify-center active:scale-95 transition-transform"
              aria-label="Notifications"
            >
              <Bell size={18} className="text-muted-foreground" />
              {unread > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent" />}
            </button>
          </div>
        </motion.div>

        {/* Desktop: two-column — accounts & actions left, activity right. */}
        <div className="space-y-5 lg:space-y-0 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-6 lg:items-start">
        <div className="space-y-5">

        {/* KYC / Trust banner */}
        {kycMeta && kycStatus !== "verified" && (
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => navigate("/profile/verify")}
            className={`w-full text-left rounded-2xl border border-border/60 ${kycMeta.bg} p-3.5 flex items-start gap-3 active:scale-[0.99] transition-transform`}
          >
            <div className="w-9 h-9 rounded-xl bg-card flex items-center justify-center shrink-0">
              <kycMeta.icon size={18} className={kycMeta.tint} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">{kycMeta.label}</p>
              <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{kycMeta.hint}</p>
            </div>
            <ChevronRight size={16} className="text-muted-foreground mt-2 shrink-0" />
          </motion.button>
        )}

        {/* Total Balance — hero moment. Serif display for the number,
            ambient glow behind, restrained. */}
        <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible">
          <GlassCard elevated className="relative overflow-hidden ambient-glow">
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="kicker text-primary">Total available</span>
                  {kycStatus === "verified" && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-success bg-success/10 rounded-full px-2 py-0.5">
                      <ShieldCheck size={10} /> Insured
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setBalanceVisible(!balanceVisible)}
                  className="p-1 rounded-full press"
                  aria-label={balanceVisible ? "Hide balance" : "Show balance"}
                >
                  {balanceVisible ? (
                    <Eye size={16} className="text-muted-foreground" />
                  ) : (
                    <EyeOff size={16} className="text-muted-foreground" />
                  )}
                </button>
              </div>
              {hydrating ? (
                <Skeleton className="h-12 w-64 mt-1" />
              ) : (
                <motion.p
                  key={balanceVisible ? "shown" : "hidden"}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className="text-serif-display text-[46px] lg:text-[56px] leading-[1.05] text-foreground mt-1 tabular-nums"
                >
                  {formatCurrency(totalBalance)}
                </motion.p>
              )}
              {!hydrating && cashFlow.net !== 0 && (
                <div className="flex items-center gap-1.5 mt-2.5">
                  {cashFlow.net > 0 ? (
                    <TrendingUp size={14} className="text-success" />
                  ) : (
                    <ArrowUpRight size={14} className="text-destructive" />
                  )}
                  <span className={`text-xs font-medium tabular-nums ${cashFlow.net > 0 ? "text-success" : "text-destructive"}`}>
                    {cashFlow.net > 0 ? "+" : "−"}
                    {formatCurrency(Math.abs(cashFlow.net))} this month
                  </span>
                </div>
              )}
            </div>
          </GlassCard>
        </motion.div>


        {dataStatus === "error" && (
          <DataErrorState message={dataError} onRetry={retry} />
        )}

        {/* Account Cards */}
        {dataStatus !== "error" && (
        <motion.div custom={1} variants={fadeUp} initial="hidden" animate="visible" className="space-y-3">
          <GlassCard onClick={() => navigate("/account/checking")} className="glow-surface flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-hero flex items-center justify-center">
                <Wallet size={18} className="text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{checking?.name ?? "Primary account"}</p>
                <p className="text-xs text-muted-foreground">{checking?.accountNumber ?? "—"}</p>
              </div>
            </div>
            <div className="text-right">
              {hydrating ? (
                <Skeleton className="h-4 w-20" />
              ) : (
                <>
                  <p className="text-sm font-bold text-foreground">
                    {formatCurrency(checking?.availableBalance)}
                  </p>
                  {(checking?.pendingAmount ?? 0) > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(checking?.pendingAmount)} pending
                    </p>
                  )}
                </>
              )}
            </div>
          </GlassCard>

          {savings && (
            <GlassCard onClick={() => navigate("/account/savings")} className="glow-surface flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl gradient-savings flex items-center justify-center">
                  <TrendingUp size={18} className="text-primary-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{savings.name}</p>
                  {savings.apy ? <p className="text-xs text-muted-foreground">{savings.apy}% APY</p> : null}
                </div>
              </div>
              <div className="text-right">
                {hydrating ? (
                  <Skeleton className="h-4 w-20" />
                ) : (
                  <p className="text-sm font-bold text-foreground">
                    {formatCurrency(savings.availableBalance)}
                  </p>
                )}
              </div>
            </GlassCard>
          )}
        </motion.div>
        )}


        {/* Early paycheck access */}
        {payroll && (payroll.eligibleNow || payroll.alreadyAdvanced) && (
          <motion.div custom={2} variants={fadeUp} initial="hidden" animate="visible">
            <GlassCard elevated onClick={() => navigate("/early-pay")} className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
                <Zap size={20} className="text-primary" strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  {payroll.alreadyAdvanced ? "Paycheck released early" : "Get paid up to 2 days early"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {payroll.alreadyAdvanced
                    ? `${payroll.merchant} · settles on payday`
                    : `${payroll.merchant} · $${payroll.averageAmount.toFixed(2)} available now`}
                </p>
              </div>
              <ChevronRight size={18} className="text-muted-foreground shrink-0" />
            </GlassCard>
          </motion.div>
        )}

        {/* Quick Actions */}
        <motion.div custom={2} variants={fadeUp} initial="hidden" animate="visible">
          <h2 className="text-section-title text-sm text-foreground mb-3">What would you like to do?</h2>
          <div className="grid grid-cols-5 gap-3">
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={() => navigate(action.path)}
                className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
              >
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <action.icon size={22} className="text-primary" strokeWidth={2} />
                </div>
                <span className="text-[11px] font-medium text-foreground text-center leading-tight">{action.label}</span>
              </button>
            ))}
          </div>
        </motion.div>

        </div>

        <div className="space-y-5">

        {/* Recent Activity */}
        <motion.div custom={3} variants={fadeUp} initial="hidden" animate="visible">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-section-title text-sm text-foreground">Recent Activity</h2>
            <button
              onClick={() => navigate("/activity")}
              className="text-xs font-medium text-primary flex items-center gap-0.5"
            >
              See All <ChevronRight size={14} />
            </button>
          </div>
          <GlassCard className="divide-y divide-border p-0 overflow-hidden">
            {hydrating && transactions.length === 0 ? (
              <div className="p-4 space-y-3">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="w-8 h-8 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-32" />
                      <Skeleton className="h-2.5 w-24" />
                    </div>
                    <Skeleton className="h-3 w-14" />
                  </div>
                ))}
              </div>
            ) : transactions.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-sm text-muted-foreground">No activity yet.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Add money or receive a deposit to see it here.
                </p>
              </div>
            ) : (
              transactions.slice(0, 5).map((tx) => (
                <button
                  key={tx.id}
                  onClick={() => navigate(`/transaction/${tx.id}`)}
                  className="flex items-center justify-between w-full px-4 py-3 active:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl w-8">{tx.icon}</span>
                    <div className="text-left">
                      <p className="text-sm font-medium text-foreground">{tx.merchant}</p>
                      <p className="text-xs text-muted-foreground">
                        {tx.category} · {formatTxDate(tx.date)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-sm font-semibold ${
                        tx.amount > 0 ? "text-success" : "text-foreground"
                      }`}
                    >
                      {tx.amount > 0 ? "+" : ""}
                      {formatCurrency(Math.abs(tx.amount))}
                    </p>
                    {tx.status === "pending" && (
                      <span className="text-[10px] text-warning font-medium">Pending</span>
                    )}
                  </div>
                </button>
              ))
            )}
          </GlassCard>
        </motion.div>

        {/* Cash Flow — derived live from real transactions this month */}
        {!hydrating && (cashFlow.moneyIn > 0 || cashFlow.moneyOut > 0) && (
          <motion.div custom={4} variants={fadeUp} initial="hidden" animate="visible">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-section-title text-sm text-foreground">Cash Flow This Month</h2>
              <button
                onClick={() => navigate("/insights")}
                className="text-xs font-medium text-primary flex items-center gap-0.5"
              >
                Details <ChevronRight size={14} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <GlassCard onClick={() => navigate("/insights")} className="glow-surface">

                <div className="flex items-center gap-2 mb-2">
                  <ArrowDownLeft size={16} className="text-success" />
                  <span className="text-xs text-muted-foreground font-medium">Money In</span>
                </div>
                <p className="text-lg font-bold text-success">
                  {formatCurrency(cashFlow.moneyIn)}
                </p>
              </GlassCard>
              <GlassCard onClick={() => navigate("/insights")} className="glow-surface">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowUpRight size={16} className="text-destructive" />
                  <span className="text-xs text-muted-foreground font-medium">Money Out</span>
                </div>
                <p className="text-lg font-bold text-foreground">
                  {formatCurrency(cashFlow.moneyOut)}
                </p>
              </GlassCard>
            </div>
          </motion.div>
        )}

        {/* Direct Deposit — uses the account deposit details when hydrated. */}
        {!hydrating && (
          <motion.div custom={5} variants={fadeUp} initial="hidden" animate="visible" className="pb-4">
            <GlassCard className="glow-surface relative overflow-hidden">

              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <Shield size={18} className="text-primary" />
                  <h2 className="text-section-title text-sm text-foreground">Deposit details</h2>
                </div>
                <div className="space-y-2">
                  {checking?.depositDetails?.iban ? (
                    <button
                      onClick={() => copyToClipboard(checking?.depositDetails!.iban!, "IBAN")}
                      className="flex items-center justify-between w-full active:opacity-70"
                    >
                      <span className="text-xs text-muted-foreground">IBAN</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono font-medium text-foreground">
                          {checking?.depositDetails?.iban}
                        </span>
                        <Copy size={14} className="text-muted-foreground" />
                      </div>
                    </button>
                  ) : (
                    <button
                      onClick={() => copyToClipboard(checking?.routingNumber ?? "", "Routing number")}
                      className="flex items-center justify-between w-full active:opacity-70"
                    >
                      <span className="text-xs text-muted-foreground">Routing Number</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono font-medium text-foreground">{checking?.routingNumber}</span>
                        <Copy size={14} className="text-muted-foreground" />
                      </div>
                    </button>
                  )}
                  <button
                    onClick={() =>
                      copyToClipboard(
                        checking?.depositDetails?.accountNumber || checking?.accountNumber || "",
                        "Account number"
                      )
                    }
                    className="flex items-center justify-between w-full active:opacity-70"
                  >
                    <span className="text-xs text-muted-foreground">Account Number</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-medium text-foreground">
                        {checking?.depositDetails?.accountNumber || checking?.accountNumber}
                      </span>
                      <Copy size={14} className="text-muted-foreground" />
                    </div>
                  </button>
                </div>
                <button onClick={shareDirectDeposit} className="mt-3 w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2">
                  <Share2 size={16} />
                  Share deposit info
                </button>
              </div>
            </GlassCard>
          </motion.div>
        )}
        </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default HomePage;

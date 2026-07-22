import { Bell, Search, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import AppLayout from "@/components/layout/AppLayout";
import GlassCard from "@/components/glass/GlassCard";
import { useBank } from "@/store/bankStore";
import {
  user,
  cashFlow,
  insights,
  savingsGoals,
} from "@/data/mockData";
import {
  ArrowUpRight,
  ArrowDownLeft,
  Send,
  ArrowLeftRight,
  Camera,
  Receipt,
  Plus,
  Lock,
  FileText,
  CreditCard,
  Copy,
  Share2,
  ChevronRight,
  TrendingUp,
  Wallet,
  Shield,
} from "lucide-react";

const quickActions = [
  { label: "Send", icon: Send, path: "/move-money/send" },
  { label: "Transfer", icon: ArrowLeftRight, path: "/move-money/transfer" },
  { label: "Deposit", icon: Camera, path: "/move-money/deposit" },
  { label: "Pay Bills", icon: Receipt, path: "/move-money/bills" },
  { label: "Add Money", icon: Plus, path: "/move-money/add" },
  { label: "View Card", icon: CreditCard, path: "/cards" },
  { label: "Lock Card", icon: Lock, path: "/cards" },
  { label: "Statements", icon: FileText, path: "/profile/documents" },
];

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
  }),
};

const HomePage = () => {
  const [balanceVisible, setBalanceVisible] = useState(true);
  const navigate = useNavigate();
  const { accounts, totalBalance, transactions, notifications } = useBank();
  const unread = notifications.filter((n) => !n.read).length;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const formatCurrency = (n: number) =>
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
    const text = `Glass Bank Direct Deposit\nRouting: ${accounts.checking.routingNumber}\nAccount: 48292946${accounts.checking.accountNumber.slice(-4)}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Direct Deposit Info", text });
        return;
      } catch { /* canceled */ }
    }
    copyToClipboard(text, "Direct deposit info");
  };

  return (
    <AppLayout>
      <div className="px-5 pt-14 space-y-5">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <p className="text-muted-foreground text-sm">{greeting},</p>
            <h1 className="text-2xl font-display font-bold tracking-tight text-foreground">
              {user.preferredName}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/activity")}
              className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center"
            >
              <Search size={18} className="text-muted-foreground" />
            </button>
            <button
              onClick={() => navigate("/notifications")}
              className="relative w-10 h-10 rounded-full bg-secondary flex items-center justify-center"
            >
              <Bell size={18} className="text-muted-foreground" />
              {unread > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent" />}
            </button>
          </div>
        </motion.div>


        {/* Total Balance Card */}
        <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible">
          <GlassCard elevated className="relative overflow-hidden">
            <div className="absolute inset-0 gradient-hero opacity-[0.07] rounded-2xl" />
            <div className="relative">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-muted-foreground font-medium">Total Available</span>
                <button
                  onClick={() => setBalanceVisible(!balanceVisible)}
                  className="p-1 rounded-full"
                >
                  {balanceVisible ? (
                    <Eye size={16} className="text-muted-foreground" />
                  ) : (
                    <EyeOff size={16} className="text-muted-foreground" />
                  )}
                </button>
              </div>
              <p className="text-balance-display text-4xl text-foreground">
                {formatCurrency(totalBalance)}
              </p>
              <div className="flex items-center gap-1.5 mt-2">
                <TrendingUp size={14} className="text-success" />
                <span className="text-xs text-success font-medium">+$4,327.00 this month</span>
              </div>
            </div>
          </GlassCard>
        </motion.div>

        {/* Account Cards */}
        <motion.div custom={1} variants={fadeUp} initial="hidden" animate="visible" className="space-y-3">
          <GlassCard onClick={() => navigate("/account/checking")} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-hero flex items-center justify-center">
                <Wallet size={18} className="text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{accounts.checking.name}</p>
                <p className="text-xs text-muted-foreground">{accounts.checking.accountNumber}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-foreground">
                {formatCurrency(accounts.checking.availableBalance)}
              </p>
              {accounts.checking.pendingAmount > 0 && (
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(accounts.checking.pendingAmount)} pending
                </p>
              )}
            </div>
          </GlassCard>

          <GlassCard onClick={() => navigate("/account/savings")} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-savings flex items-center justify-center">
                <TrendingUp size={18} className="text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{accounts.savings.name}</p>
                <p className="text-xs text-muted-foreground">{accounts.savings.apy}% APY</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-foreground">
                {formatCurrency(accounts.savings.availableBalance)}
              </p>
              <p className="text-xs text-success font-medium">
                +${accounts.savings.interestEarned.toFixed(2)} earned
              </p>
            </div>
          </GlassCard>
        </motion.div>

        {/* Quick Actions */}
        <motion.div custom={2} variants={fadeUp} initial="hidden" animate="visible">
          <h2 className="text-section-title text-sm text-foreground mb-3">Quick Actions</h2>
          <div className="grid grid-cols-4 gap-3">
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={() => navigate(action.path)}
                className="flex flex-col items-center gap-1.5"
              >
                <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center active:scale-95 transition-transform">
                  <action.icon size={20} className="text-foreground" />
                </div>
                <span className="text-[10px] font-medium text-muted-foreground">{action.label}</span>
              </button>
            ))}
          </div>
        </motion.div>

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
            {transactions.slice(0, 5).map((tx) => (
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
                      {tx.category} · {tx.date}
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
            ))}
          </GlassCard>
        </motion.div>

        {/* Cash Flow */}
        <motion.div custom={4} variants={fadeUp} initial="hidden" animate="visible">
          <h2 className="text-section-title text-sm text-foreground mb-3">Cash Flow This Month</h2>
          <div className="grid grid-cols-2 gap-3">
            <GlassCard>
              <div className="flex items-center gap-2 mb-2">
                <ArrowDownLeft size={16} className="text-success" />
                <span className="text-xs text-muted-foreground font-medium">Money In</span>
              </div>
              <p className="text-lg font-bold text-success">
                {formatCurrency(cashFlow.moneyIn)}
              </p>
            </GlassCard>
            <GlassCard>
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

        {/* Smart Insights */}
        <motion.div custom={5} variants={fadeUp} initial="hidden" animate="visible">
          <h2 className="text-section-title text-sm text-foreground mb-3">Smart Insights</h2>
          <div className="space-y-2">
            {insights.map((insight) => (
              <GlassCard key={insight.id} className="flex items-center gap-3 py-3">
                <span className="text-lg">{insight.icon}</span>
                <p className="text-sm text-foreground flex-1">{insight.text}</p>
                <ChevronRight size={16} className="text-muted-foreground" />
              </GlassCard>
            ))}
          </div>
        </motion.div>

        {/* Savings Goals */}
        <motion.div custom={6} variants={fadeUp} initial="hidden" animate="visible">
          <h2 className="text-section-title text-sm text-foreground mb-3">Savings Goals</h2>
          <div className="space-y-3">
            {savingsGoals.map((goal) => {
              const pct = Math.round((goal.current / goal.target) * 100);
              return (
                <GlassCard key={goal.id}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{goal.icon}</span>
                      <span className="text-sm font-semibold text-foreground">{goal.name}</span>
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">{pct}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
                      className="h-full rounded-full gradient-hero"
                    />
                  </div>
                  <div className="flex justify-between mt-1.5">
                    <span className="text-xs text-muted-foreground">
                      {formatCurrency(goal.current)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatCurrency(goal.target)}
                    </span>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        </motion.div>

        {/* Direct Deposit */}
        <motion.div custom={7} variants={fadeUp} initial="hidden" animate="visible">
          <GlassCard className="relative overflow-hidden">
            <div className="absolute inset-0 gradient-hero opacity-[0.05] rounded-2xl" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <Shield size={18} className="text-primary" />
                <h2 className="text-section-title text-sm text-foreground">Direct Deposit</h2>
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => copyToClipboard(accounts.checking.routingNumber, "Routing number")}
                  className="flex items-center justify-between w-full active:opacity-70"
                >
                  <span className="text-xs text-muted-foreground">Routing Number</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-medium text-foreground">{accounts.checking.routingNumber}</span>
                    <Copy size={14} className="text-muted-foreground" />
                  </div>
                </button>
                <button
                  onClick={() => copyToClipboard(`48292946${accounts.checking.accountNumber.slice(-4)}`, "Account number")}
                  className="flex items-center justify-between w-full active:opacity-70"
                >
                  <span className="text-xs text-muted-foreground">Account Number</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-medium text-foreground">{accounts.checking.accountNumber}</span>
                    <Copy size={14} className="text-muted-foreground" />
                  </div>
                </button>
              </div>
              <button onClick={shareDirectDeposit} className="mt-3 w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2">
                <Share2 size={16} />
                Share Direct Deposit Info
              </button>
            </div>
          </GlassCard>
        </motion.div>

        {/* Financial Wellness */}
        <motion.div custom={8} variants={fadeUp} initial="hidden" animate="visible" className="pb-4">
          <GlassCard className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center">
                <Shield size={18} className="text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Credit Score</p>
                <p className="text-xs text-muted-foreground">Monitoring available</p>
              </div>
            </div>
            <div className="text-right flex items-center gap-2">
              <span className="text-2xl font-bold text-foreground">742</span>
              <ChevronRight size={16} className="text-muted-foreground" />
            </div>
          </GlassCard>
        </motion.div>
      </div>
    </AppLayout>
  );
};

export default HomePage;

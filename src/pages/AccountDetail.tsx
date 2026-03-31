import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import GlassCard from "@/components/glass/GlassCard";
import { accounts, transactions } from "@/data/mockData";
import {
  ArrowLeft,
  Copy,
  Search,
  ChevronRight,
  Settings,
  FileText,
  Edit3,
  Shield,
  TrendingUp,
  Wallet,
} from "lucide-react";

const AccountDetail = () => {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"transactions" | "details" | "statements" | "settings">("transactions");
  const account = type === "savings" ? accounts.savings : accounts.checking;
  const acctTransactions = transactions.filter(
    (t) => t.account === (type === "savings" ? "Savings" : "Checking")
  );

  const formatCurrency = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD" });

  return (
    <div className="min-h-screen bg-background">
      <div className="px-5 pt-14 space-y-5 pb-10">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
            <ArrowLeft size={20} className="text-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-display font-bold text-foreground">{account.name}</h1>
            <p className="text-xs text-muted-foreground">{account.accountNumber}</p>
          </div>
          <div className={`w-10 h-10 rounded-xl ${type === "savings" ? "gradient-savings" : "gradient-hero"} flex items-center justify-center`}>
            {type === "savings" ? <TrendingUp size={18} className="text-primary-foreground" /> : <Wallet size={18} className="text-primary-foreground" />}
          </div>
        </div>

        {/* Balance */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <GlassCard elevated>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">Available Balance</span>
              {type === "savings" && (
                <span className="text-xs font-medium text-success bg-success/10 px-2 py-0.5 rounded-full">{account.apy}% APY</span>
              )}
            </div>
            <p className="text-3xl font-display font-bold text-foreground">{formatCurrency(account.availableBalance)}</p>
            <div className="flex gap-4 mt-3">
              <div>
                <p className="text-xs text-muted-foreground">Current</p>
                <p className="text-sm font-semibold text-foreground">{formatCurrency(account.currentBalance)}</p>
              </div>
              {account.pendingAmount > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground">Pending</p>
                  <p className="text-sm font-semibold text-warning">{formatCurrency(account.pendingAmount)}</p>
                </div>
              )}
              {type === "savings" && "interestEarned" in account && (
                <div>
                  <p className="text-xs text-muted-foreground">Interest Earned</p>
                  <p className="text-sm font-semibold text-success">{formatCurrency(account.interestEarned)}</p>
                </div>
              )}
            </div>
          </GlassCard>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-1 bg-secondary rounded-xl p-1">
          {(["transactions", "details", "statements", "settings"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === tab ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {activeTab === "transactions" && (
          <div>
            <div className="relative mb-3">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input placeholder="Search transactions..." className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-secondary text-foreground text-sm border-0 outline-none" />
            </div>
            <GlassCard className="divide-y divide-border p-0 overflow-hidden">
              {acctTransactions.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">No transactions yet</div>
              ) : (
                acctTransactions.map((tx) => (
                  <button key={tx.id} onClick={() => navigate(`/transaction/${tx.id}`)} className="flex items-center justify-between w-full px-4 py-3 active:bg-secondary/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-lg w-7">{tx.icon}</span>
                      <div className="text-left">
                        <p className="text-sm font-medium text-foreground">{tx.merchant}</p>
                        <p className="text-xs text-muted-foreground">{tx.date}</p>
                      </div>
                    </div>
                    <span className={`text-sm font-semibold ${tx.amount > 0 ? "text-success" : "text-foreground"}`}>
                      {tx.amount > 0 ? "+" : ""}${Math.abs(tx.amount).toFixed(2)}
                    </span>
                  </button>
                ))
              )}
            </GlassCard>
          </div>
        )}

        {activeTab === "details" && (
          <GlassCard className="space-y-3">
            {[
              { label: "Account Nickname", value: account.name },
              { label: "Account Number", value: account.accountNumber },
              { label: "Routing Number", value: account.routingNumber },
              { label: "Account Status", value: "Active" },
              { label: "Opened", value: account.openedDate },
              { label: "Account Type", value: account.type === "savings" ? "High Yield Savings" : "Checking" },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{row.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{row.value}</span>
                  {(row.label.includes("Number")) && <Copy size={14} className="text-muted-foreground" />}
                </div>
              </div>
            ))}
          </GlassCard>
        )}

        {activeTab === "statements" && (
          <div className="space-y-2">
            {["March 2026", "February 2026", "January 2026", "December 2025", "November 2025"].map((month) => (
              <GlassCard key={month} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <FileText size={18} className="text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">{month}</span>
                </div>
                <ChevronRight size={16} className="text-muted-foreground" />
              </GlassCard>
            ))}
          </div>
        )}

        {activeTab === "settings" && (
          <div className="space-y-2">
            {[
              { icon: Edit3, label: "Rename Account" },
              { icon: Shield, label: "Overdraft Preferences" },
              { icon: Settings, label: "Account Alerts" },
            ].map((item) => (
              <GlassCard key={item.label} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <item.icon size={18} className="text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">{item.label}</span>
                </div>
                <ChevronRight size={16} className="text-muted-foreground" />
              </GlassCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AccountDetail;

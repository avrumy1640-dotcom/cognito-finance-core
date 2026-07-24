import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import GlassCard from "@/components/glass/GlassCard";
import { useBank } from "@/store/bankStore";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  PieChart,
  Target,
  Sparkles,
} from "lucide-react";

// Insights are derived from real transactions only. Budgets, Goals, and
// Subscription-tracking are shown as "coming soon" because we don't yet have
// real backing data for them — better to be honest than fabricate numbers
// next to real balances.
const SpendingInsights = () => {
  const navigate = useNavigate();
  const { transactions } = useBank();
  const [activeTab, setActiveTab] = useState<"spending" | "budgets" | "goals" | "subscriptions">("spending");

  const { total, prevTotal, deltaPct, byMerchant } = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const startOfPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    let cur = 0;
    let prev = 0;
    const merchants = new Map<string, { amount: number; icon?: string; category?: string }>();
    for (const tx of transactions) {
      if (tx.status !== "posted" || tx.amount >= 0) continue;
      const t = new Date(tx.date).getTime();
      if (Number.isNaN(t)) continue;
      const abs = Math.abs(tx.amount);
      if (t >= startOfMonth) {
        cur += abs;
        const key = tx.merchant || tx.category || "Other";
        const entry = merchants.get(key) ?? { amount: 0, icon: tx.icon, category: tx.category };
        entry.amount += abs;
        merchants.set(key, entry);
      } else if (t >= startOfPrev) {
        prev += abs;
      }
    }
    const list = Array.from(merchants.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);
    const delta = prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null;
    return { total: cur, prevTotal: prev, deltaPct: delta, byMerchant: list };
  }, [transactions]);

  const maxMerchant = byMerchant[0]?.amount ?? 1;

  return (
    <div className="min-h-screen bg-background">
      <div className="px-5 pt-14 space-y-5 pb-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
            <ArrowLeft size={20} className="text-foreground" />
          </button>
          <h1 className="text-lg font-display font-bold text-foreground">Money Insights</h1>
        </div>

        <div className="flex gap-1 bg-secondary rounded-xl p-1">
          {(["spending", "budgets", "goals", "subscriptions"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-lg text-[11px] font-medium capitalize transition-all ${
                activeTab === tab ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === "spending" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <GlassCard elevated>
              <p className="text-sm text-muted-foreground mb-1">Total spending this month</p>
              <p className="text-3xl font-display font-bold text-foreground">
                ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              {deltaPct !== null ? (
                <div className="flex items-center gap-1.5 mt-1">
                  {deltaPct >= 0 ? (
                    <TrendingUp size={14} className="text-destructive" />
                  ) : (
                    <TrendingDown size={14} className="text-success" />
                  )}
                  <span className={`text-xs font-medium ${deltaPct >= 0 ? "text-destructive" : "text-success"}`}>
                    {deltaPct >= 0 ? "+" : ""}{deltaPct}% vs last month
                  </span>
                </div>
              ) : prevTotal === 0 && total === 0 ? (
                <p className="text-xs text-muted-foreground mt-1">No spending yet — you're all clear.</p>
              ) : null}
            </GlassCard>

            {byMerchant.length === 0 ? (
              <GlassCard className="text-center py-10">
                <PieChart size={36} className="text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-semibold text-foreground">Nothing to analyze yet</p>
                <p className="text-xs text-muted-foreground mt-1">Your top merchants will appear here once transactions post.</p>
              </GlassCard>
            ) : (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold px-1">Top merchants</p>
                {byMerchant.map((m) => (
                  <GlassCard key={m.name} className="flex items-center gap-3 py-3">
                    <span className="text-lg w-8">{m.icon ?? "💳"}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-foreground truncate">{m.name}</span>
                        <span className="text-sm font-semibold text-foreground">
                          ${m.amount.toFixed(2)}
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full rounded-full gradient-hero" style={{ width: `${(m.amount / maxMerchant) * 100}%` }} />
                      </div>
                      {m.category && (
                        <p className="text-[10px] text-muted-foreground mt-1">{m.category}</p>
                      )}
                    </div>
                  </GlassCard>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === "budgets" && (
          <ComingSoon icon={PieChart} title="Category budgets" description="Set monthly spending caps and get warned before you overshoot. We're building this on top of real transaction categorization." />
        )}
        {activeTab === "goals" && (
          <ComingSoon icon={Target} title="Savings goals" description="Round-up rules, auto-transfers to goal envelopes, and progress tracking are on the roadmap." />
        )}
        {activeTab === "subscriptions" && (
          <ComingSoon icon={Sparkles} title="Subscription tracker" description="We'll automatically detect recurring merchants once your transaction history builds up." />
        )}
      </div>
    </div>
  );
};

const ComingSoon = ({ icon: Icon, title, description }: { icon: typeof PieChart; title: string; description: string }) => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
    <GlassCard elevated className="text-center py-10">
      <Icon size={40} className="text-primary mx-auto mb-3" />
      <h2 className="text-lg font-display font-bold text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">{description}</p>
      <div className="inline-flex items-center gap-1.5 mt-4 text-[10px] font-semibold uppercase tracking-widest text-primary bg-primary/10 rounded-full px-3 py-1">
        Coming soon
      </div>
    </GlassCard>
  </motion.div>
);

export default SpendingInsights;

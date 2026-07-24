import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import GlassCard from "@/components/glass/GlassCard";
import { useBank } from "@/store/bankStore";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  PieChart,
} from "lucide-react";

// Insights are derived from real transactions only. Budgets, Goals, and
// Subscription-tracking are intentionally hidden until real backing data
// exists — better to ship a single honest view than four hollow tabs.
const SpendingInsights = () => {
  const navigate = useNavigate();
  const { transactions } = useBank();

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
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center press">
            <ArrowLeft size={20} className="text-foreground" />
          </button>
          <div>
            <p className="kicker text-primary">Insights</p>
            <h1 className="text-lg font-display font-bold text-foreground leading-tight">This month's spending</h1>
          </div>
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <GlassCard elevated>
            <p className="text-sm text-muted-foreground mb-1">Total spending this month</p>
            <p className="text-serif-display text-4xl text-foreground tabular-nums">
              ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            {deltaPct !== null ? (
              <div className="flex items-center gap-1.5 mt-2">
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
              <p className="kicker text-muted-foreground px-1">Top merchants</p>
              {byMerchant.map((m) => (
                <GlassCard key={m.name} className="flex items-center gap-3 py-3">
                  <span className="text-lg w-8">{m.icon ?? "💳"}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-foreground truncate">{m.name}</span>
                      <span className="text-sm font-semibold text-foreground tabular-nums">
                        ${m.amount.toFixed(2)}
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full rounded-full gradient-navy" style={{ width: `${(m.amount / maxMerchant) * 100}%` }} />
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
      </div>
    </div>
  );
};

export default SpendingInsights;

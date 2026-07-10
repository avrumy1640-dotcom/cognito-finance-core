import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import GlassCard from "@/components/glass/GlassCard";
import { monthlySpending, savingsGoals } from "@/data/mockData";
import {
  ArrowLeft,
  TrendingUp,
  PieChart,
  Target,
  ChevronRight,
  Plus,
  Bell,
} from "lucide-react";

const SpendingInsights = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"spending" | "budgets" | "goals" | "subscriptions">("spending");

  return (
    <div className="min-h-screen bg-background">
      <div className="px-5 pt-14 space-y-5 pb-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
            <ArrowLeft size={20} className="text-foreground" />
          </button>
          <h1 className="text-lg font-display font-bold text-foreground">Money Insights</h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-secondary rounded-xl p-1">
          {(["spending", "budgets", "goals", "subscriptions"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-lg text-[11px] font-medium transition-all ${
                activeTab === tab ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {activeTab === "spending" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <GlassCard elevated>
              <p className="text-sm text-muted-foreground mb-1">Total Spending This Month</p>
              <p className="text-3xl font-display font-bold text-foreground">${monthlySpending.total.toLocaleString()}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <TrendingUp size={14} className="text-destructive" />
                <span className="text-xs text-destructive font-medium">+12% vs last month</span>
              </div>
            </GlassCard>

            <div className="space-y-2">
              {monthlySpending.categories.map((cat) => (
                <button
                  key={cat.name}
                  onClick={() => toast.info(`${cat.name}: $${cat.amount.toFixed(2)} · ${cat.percentage}% of month`)}
                  className="w-full text-left"
                >
                  <GlassCard className="flex items-center gap-3 py-3">
                    <span className="text-lg w-8">{cat.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-foreground">{cat.name}</span>
                        <span className="text-sm font-semibold text-foreground">${cat.amount.toFixed(2)}</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full rounded-full gradient-hero" style={{ width: `${cat.percentage}%` }} />
                      </div>
                    </div>
                  </GlassCard>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === "budgets" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <GlassCard elevated className="text-center">
              <PieChart size={40} className="text-primary mx-auto mb-3" />
              <h2 className="text-lg font-display font-bold text-foreground">Monthly Budget</h2>
              <p className="text-3xl font-display font-bold text-foreground mt-1">$3,500.00</p>
              <p className="text-sm text-muted-foreground mt-1">${(3500 - monthlySpending.total).toFixed(2)} remaining</p>
              <div className="w-full h-2 rounded-full bg-secondary mt-3 overflow-hidden">
                <div className="h-full rounded-full gradient-hero" style={{ width: `${(monthlySpending.total / 3500) * 100}%` }} />
              </div>
            </GlassCard>

            {monthlySpending.categories.map((cat) => (
              <button
                key={cat.name}
                onClick={() => {
                  const next = prompt(`Set monthly budget for ${cat.name} (USD)`, "500");
                  if (next && !isNaN(Number(next))) toast.success(`${cat.name} budget set to $${Number(next).toFixed(2)}`);
                }}
                className="w-full text-left"
              >
                <GlassCard className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{cat.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-foreground">{cat.name}</p>
                      <p className="text-xs text-muted-foreground">${cat.amount.toFixed(2)} of $500</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {cat.amount > 450 && <Bell size={14} className="text-warning" />}
                    <ChevronRight size={16} className="text-muted-foreground" />
                  </div>
                </GlassCard>
              </button>
            ))}

            <button
              onClick={() => {
                const name = prompt("New budget category name");
                if (name) toast.success(`Budget added for ${name}`);
              }}
              className="w-full py-3 rounded-xl bg-secondary text-foreground text-sm font-semibold flex items-center justify-center gap-2"
            >
              <Plus size={16} /> Add Category Budget
            </button>
          </motion.div>
        )}

        {activeTab === "goals" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            {savingsGoals.map((goal) => {
              const pct = Math.round((goal.current / goal.target) * 100);
              return (
                <GlassCard key={goal.id}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{goal.icon}</span>
                      <span className="text-sm font-semibold text-foreground">{goal.name}</span>
                    </div>
                    <span className="text-xs font-medium text-primary">{pct}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full rounded-full gradient-hero" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between mt-1.5">
                    <span className="text-xs text-muted-foreground">${goal.current.toLocaleString()}</span>
                    <span className="text-xs text-muted-foreground">${goal.target.toLocaleString()}</span>
                  </div>
                </GlassCard>
              );
            })}
            <button className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2">
              <Plus size={16} /> Create New Goal
            </button>
          </motion.div>
        )}

        {activeTab === "subscriptions" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <GlassCard elevated>
              <p className="text-sm text-muted-foreground mb-1">Monthly Subscriptions</p>
              <p className="text-3xl font-display font-bold text-foreground">$89.47</p>
              <p className="text-xs text-muted-foreground mt-1">6 active subscriptions</p>
            </GlassCard>
            {[
              { name: "Spotify Premium", amount: 10.99, next: "Apr 1", icon: "🎵" },
              { name: "Netflix", amount: 15.49, next: "Apr 3", icon: "🎬" },
              { name: "iCloud+", amount: 2.99, next: "Apr 5", icon: "☁️" },
              { name: "Adobe Creative", amount: 54.99, next: "Apr 12", icon: "🎨" },
              { name: "NYT Digital", amount: 5.00, next: "Apr 15", icon: "📰" },
            ].map((sub) => (
              <GlassCard key={sub.name} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{sub.icon}</span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{sub.name}</p>
                    <p className="text-xs text-muted-foreground">Next: {sub.next}</p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-foreground">${sub.amount.toFixed(2)}</span>
              </GlassCard>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default SpendingInsights;

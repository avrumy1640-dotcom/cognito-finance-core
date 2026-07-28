import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import GlassCard from "@/components/glass/GlassCard";
import { useBank } from "@/store/bankStore";
import { loadBudgets, saveBudgets, type Budgets } from "@/lib/budgets";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  CartesianGrid,
  Cell,
} from "recharts";
import { ArrowLeft, TrendingUp, TrendingDown, PieChart, Wallet } from "lucide-react";

const RANGES = [30, 60, 90] as const;
type Range = (typeof RANGES)[number];

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const money2 = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

const PALETTE = [
  "hsl(var(--primary))",
  "hsl(var(--success))",
  "hsl(var(--accent))",
  "hsl(var(--destructive))",
  "hsl(var(--muted-foreground))",
];

const SpendingInsights = () => {
  const navigate = useNavigate();
  const { transactions } = useBank();
  const [range, setRange] = useState<Range>(30);
  const [budgets, setBudgets] = useState<Budgets>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => { setBudgets(loadBudgets()); }, []);

  const debits = useMemo(
    () =>
      transactions.filter(
        (t) => t.amount < 0 && t.status === "posted" && t.category !== "Transfers" && !Number.isNaN(+new Date(t.date)),
      ),
    [transactions],
  );

  // --- category breakdown over the selected window --------------------------
  const { byCategory, rangeTotal } = useMemo(() => {
    const cutoff = Date.now() - range * 86_400_000;
    const map = new Map<string, number>();
    let total = 0;
    for (const t of debits) {
      if (+new Date(t.date) < cutoff) continue;
      const key = t.category || "Other";
      const abs = Math.abs(t.amount);
      map.set(key, (map.get(key) ?? 0) + abs);
      total += abs;
    }
    const list = Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value);
    return { byCategory: list, rangeTotal: total };
  }, [debits, range]);

  // --- this month vs last month --------------------------------------------
  const { monthTotal, prevMonthTotal, deltaPct } = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const startOfPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    let cur = 0, prev = 0;
    for (const t of debits) {
      const ts = +new Date(t.date);
      const abs = Math.abs(t.amount);
      if (ts >= startOfMonth) cur += abs;
      else if (ts >= startOfPrev) prev += abs;
    }
    return {
      monthTotal: cur,
      prevMonthTotal: prev,
      deltaPct: prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null,
    };
  }, [debits]);

  // --- month over month trend (last 6 months) -------------------------------
  const trend = useMemo(() => {
    const now = new Date();
    const buckets: { label: string; key: string; spent: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        label: d.toLocaleDateString("en-US", { month: "short" }),
        key: `${d.getFullYear()}-${d.getMonth()}`,
        spent: 0,
      });
    }
    const index = new Map(buckets.map((b) => [b.key, b]));
    for (const t of debits) {
      const d = new Date(t.date);
      const b = index.get(`${d.getFullYear()}-${d.getMonth()}`);
      if (b) b.spent += Math.abs(t.amount);
    }
    return buckets.map((b) => ({ ...b, spent: Math.round(b.spent * 100) / 100 }));
  }, [debits]);

  // --- month-to-date spend per category, for budget progress ----------------
  const monthByCategory = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const map = new Map<string, number>();
    for (const t of debits) {
      if (+new Date(t.date) < startOfMonth) continue;
      const key = t.category || "Other";
      map.set(key, (map.get(key) ?? 0) + Math.abs(t.amount));
    }
    return map;
  }, [debits]);

  const categories = useMemo(() => {
    const all = new Set<string>([...byCategory.map((c) => c.name), ...Object.keys(budgets)]);
    return Array.from(all).sort();
  }, [byCategory, budgets]);

  const commitBudget = (category: string) => {
    const amt = Number(draft);
    const next = { ...budgets };
    if (!draft.trim() || !Number.isFinite(amt) || amt <= 0) delete next[category];
    else next[category] = Math.round(amt * 100) / 100;
    setBudgets(next);
    saveBudgets(next);
    setEditing(null);
    setDraft("");
    toast.success(next[category] ? `Budget set for ${category}` : `Budget cleared for ${category}`);
  };

  const budgetedTotal = Object.values(budgets).reduce((s, n) => s + n, 0);

  return (
    <div className="min-h-screen bg-background">
      <div className="px-5 pt-14 space-y-5 pb-12">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center press">
            <ArrowLeft size={20} className="text-foreground" />
          </button>
          <div>
            <p className="kicker text-primary">Insights</p>
            <h1 className="text-lg font-display font-bold text-foreground leading-tight">Spending &amp; budgets</h1>
          </div>
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <GlassCard elevated>
            <p className="text-sm text-muted-foreground mb-1">Spent this month</p>
            <p className="text-serif-display text-4xl text-foreground tabular-nums">{money2(monthTotal)}</p>
            {deltaPct !== null ? (
              <div className="flex items-center gap-1.5 mt-2">
                {deltaPct >= 0 ? <TrendingUp size={14} className="text-destructive" /> : <TrendingDown size={14} className="text-success" />}
                <span className={`text-xs font-medium ${deltaPct >= 0 ? "text-destructive" : "text-success"}`}>
                  {deltaPct >= 0 ? "+" : ""}{deltaPct}% vs last month ({money(prevMonthTotal)})
                </span>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">No comparable spending last month yet.</p>
            )}
          </GlassCard>

          {/* Range selector */}
          <div className="flex gap-2">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  range === r ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                }`}
              >
                Last {r} days
              </button>
            ))}
          </div>

          {/* Category breakdown */}
          <GlassCard className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PieChart size={16} className="text-primary" />
                <h2 className="text-sm font-semibold text-foreground">By category</h2>
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">{money2(rangeTotal)}</span>
            </div>
            {byCategory.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">No posted spending in this window.</p>
            ) : (
              <>
                <div className="h-56 -ml-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byCategory} layout="vertical" margin={{ left: 8, right: 12 }}>
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={104}
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: "hsl(var(--secondary))" }}
                        formatter={(v: number) => money2(v)}
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 12,
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                        {byCategory.map((c, i) => (
                          <Cell key={c.name} fill={PALETTE[i % PALETTE.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1">
                  {byCategory.slice(0, 6).map((c) => (
                    <div key={c.name} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{c.name}</span>
                      <span className="text-foreground tabular-nums font-medium">
                        {money2(c.value)} · {rangeTotal ? Math.round((c.value / rangeTotal) * 100) : 0}%
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </GlassCard>

          {/* Trend */}
          <GlassCard className="space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Monthly trend</h2>
            </div>
            <div className="h-48 -ml-3">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ left: 4, right: 12, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={52} tickFormatter={(v: number) => money(v)} />
                  <Tooltip
                    formatter={(v: number) => money2(v)}
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  <Line type="monotone" dataKey="spent" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          {/* Budgets */}
          <GlassCard className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet size={16} className="text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Monthly budgets</h2>
              </div>
              {budgetedTotal > 0 && (
                <span className="text-xs text-muted-foreground tabular-nums">{money(budgetedTotal)} budgeted</span>
              )}
            </div>
            {categories.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Categories appear once transactions post.</p>
            ) : (
              <div className="space-y-3">
                {categories.map((cat) => {
                  const spent = monthByCategory.get(cat) ?? 0;
                  const budget = budgets[cat];
                  const pct = budget ? Math.min(100, (spent / budget) * 100) : 0;
                  const over = budget ? spent > budget : false;
                  return (
                    <div key={cat} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-foreground truncate">{cat}</span>
                        {editing === cat ? (
                          <input
                            autoFocus
                            inputMode="decimal"
                            value={draft}
                            onChange={(e) => setDraft(e.target.value.replace(/[^\d.]/g, ""))}
                            onBlur={() => commitBudget(cat)}
                            onKeyDown={(e) => { if (e.key === "Enter") commitBudget(cat); }}
                            placeholder="0"
                            className="w-24 px-2 py-1 rounded-lg bg-secondary text-foreground text-xs text-right tabular-nums border-0 outline-none"
                          />
                        ) : (
                          <button
                            onClick={() => { setEditing(cat); setDraft(budget ? String(budget) : ""); }}
                            className="text-xs text-muted-foreground tabular-nums px-2 py-1 rounded-lg bg-secondary"
                          >
                            {budget ? `${money2(spent)} / ${money(budget)}` : "Set budget"}
                          </button>
                        )}
                      </div>
                      {budget ? (
                        <>
                          <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                            <div className={`h-full rounded-full ${over ? "bg-destructive" : "gradient-navy"}`} style={{ width: `${pct}%` }} />
                          </div>
                          <p className={`text-[11px] ${over ? "text-destructive" : "text-muted-foreground"}`}>
                            {over
                              ? `${money2(spent - budget)} over budget`
                              : `${money2(budget - spent)} left this month`}
                          </p>
                        </>
                      ) : (
                        <p className="text-[11px] text-muted-foreground">{money2(spent)} spent this month</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
};

export default SpendingInsights;

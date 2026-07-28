import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import GlassCard from "@/components/glass/GlassCard";
import { useBank } from "@/store/bankStore";
import type { CreditFactorStatus } from "@/lib/demoBank";
import { ArrowLeft, TrendingUp, TrendingDown, GraduationCap, CreditCard } from "lucide-react";

const statusChip: Record<CreditFactorStatus, string> = {
  excellent: "bg-success/10 text-success",
  good: "bg-primary/10 text-primary",
  fair: "bg-secondary text-muted-foreground",
  poor: "bg-destructive/10 text-destructive",
};

const statusLabel: Record<CreditFactorStatus, string> = {
  excellent: "Excellent",
  good: "Good",
  fair: "Fair",
  poor: "Needs work",
};

const Credit = () => {
  const navigate = useNavigate();
  const { credit, card } = useBank();

  return (
    <div className="min-h-dvh bg-background">
      <div className="px-5 sm:px-6 lg:px-0 pt-10 sm:pt-12 space-y-5 pb-12">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="h-11 w-11 rounded-full bg-secondary flex items-center justify-center press" aria-label="Back">
            <ArrowLeft size={20} className="text-foreground" />
          </button>
          <div>
            <p className="kicker text-primary">Credit</p>
            <h1 className="text-lg font-display font-bold text-foreground leading-tight">Credit builder</h1>
          </div>
        </div>

        {!credit ? (
          <GlassCard className="text-center py-10">
            <p className="text-sm text-muted-foreground">Your credit profile is loading…</p>
          </GlassCard>
        ) : (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <GlassCard elevated className="relative overflow-hidden">
              <div className="absolute inset-0 gradient-hero opacity-[0.08] rounded-2xl" />
              <div className="relative space-y-2">
                <p className="text-sm font-semibold text-foreground">Your simulated score</p>
                <div className="flex items-end gap-3">
                  <p className="text-serif-display text-5xl text-foreground tabular-nums leading-none">{credit.score}</p>
                  <span
                    className={`mb-1 text-xs font-semibold px-2 py-1 rounded-full flex items-center gap-1 ${
                      credit.delta >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {credit.delta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {credit.delta >= 0 ? "+" : ""}
                    {credit.delta} in 12 mo
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {credit.band} · VantageScore-style range 300–850
                </p>
                <div className="h-40 -mx-2 pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={credit.history} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={10} stroke="hsl(var(--muted-foreground))" />
                      <YAxis domain={["dataMin - 20", "dataMax + 20"]} width={34} tickLine={false} axisLine={false} fontSize={10} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 12,
                          fontSize: 12,
                        }}
                      />
                      <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </GlassCard>

            <div className="space-y-2">
              <p className="kicker text-muted-foreground px-1">What's affecting your score</p>
              {credit.factors.map((f) => (
                <GlassCard key={f.key} className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{f.label}</p>
                      <p className="text-xs text-muted-foreground">{f.detail}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-[11px] font-semibold px-2 py-1 rounded-full ${statusChip[f.status]}`}>
                        {statusLabel[f.status]}
                      </span>
                      <p className="text-[10px] text-muted-foreground mt-1">{f.impact} impact</p>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>

            <GlassCard className="space-y-2">
              <div className="flex items-center gap-2">
                <GraduationCap size={16} className="text-primary" />
                <p className="text-sm font-semibold text-foreground">How the {card?.nickname ?? "Glass Card"} builds credit</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Your Glass Card works like a secured card: spending is backed by your own checking balance, so there's no
                debt to fall behind on. Everyday purchases — groceries, gas, your phone bill — are reported as on-time
                activity each month, which is the single biggest driver of a score.
              </p>
              <p className="text-xs text-muted-foreground">
                Keep utilization under 30% of your ${"2,000"} line, let the account age, and pay bills through Glass Bank to
                strengthen payment history and credit mix over time.
              </p>
              <button
                onClick={() => navigate("/cards")}
                className="mt-1 w-full py-3 rounded-xl bg-secondary text-foreground text-sm font-semibold flex items-center justify-center gap-2 press"
              >
                <CreditCard size={16} />
                Manage your card
              </button>
            </GlassCard>

            <p className="text-[11px] text-muted-foreground text-center px-6">
              This score is a simulation for demonstration and is not a credit-bureau score.
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Credit;

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import GlassCard from "@/components/glass/GlassCard";
import { useBank } from "@/store/bankStore";
import { ArrowLeft, Plus, Target, Trash2, Coins, X, Sparkles } from "lucide-react";

const EMOJIS = ["🎯", "🛟", "✈️", "🏠", "🚗", "🎓", "💍", "🎁"];

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const Goals = () => {
  const navigate = useNavigate();
  const {
    goals,
    roundUpGoalId,
    accounts,
    transactions,
    createGoal,
    contributeToGoal,
    deleteGoal,
    setRoundUpGoal,
    runRoundUpSweep,
  } = useBank();

  const [createOpen, setCreateOpen] = useState(false);
  const [contributeFor, setContributeFor] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🎯");
  const [target, setTarget] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const totalSaved = goals.reduce((s, g) => s + g.saved, 0);
  const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0);

  // Estimate of what a sweep would collect, so the toggle isn't a black box.
  const pendingRoundUp = useMemo(() => {
    const cutoff = Date.now() - 30 * 86_400_000;
    return transactions
      .filter((t) => t.amount < 0 && t.status === "posted" && t.category !== "Transfers" && +new Date(t.date) >= cutoff)
      .reduce((s, t) => {
        const abs = Math.abs(t.amount);
        return s + (Math.ceil(abs) - abs);
      }, 0);
  }, [transactions]);

  const resetForm = () => {
    setName(""); setEmoji("🎯"); setTarget(""); setTargetDate("");
  };

  const submitCreate = async () => {
    const amt = Number(target);
    if (!name.trim()) return toast.error("Give your goal a name");
    if (!Number.isFinite(amt) || amt <= 0) return toast.error("Enter a target amount");
    if (!targetDate) return toast.error("Pick a target date");
    setBusy(true);
    const ok = await createGoal({ name, emoji, targetAmount: amt, targetDate });
    setBusy(false);
    if (ok) { setCreateOpen(false); resetForm(); }
  };

  const submitContribution = async () => {
    const amt = Number(amount);
    if (!contributeFor) return;
    if (!Number.isFinite(amt) || amt <= 0) return toast.error("Enter an amount");
    if (accounts.checking && amt > accounts.checking.availableBalance) {
      return toast.error("Not enough available in checking");
    }
    setBusy(true);
    const ok = await contributeToGoal({ goalId: contributeFor, amount: amt });
    setBusy(false);
    if (ok) { setContributeFor(null); setAmount(""); }
  };

  return (
    <div className="min-h-dvh bg-background">
      <div className="px-5 sm:px-6 lg:px-0 pt-10 sm:pt-12 pb-12 space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="h-11 w-11 rounded-full bg-secondary flex items-center justify-center">
            <ArrowLeft size={20} className="text-foreground" />
          </button>
          <div className="flex-1">
            <p className="kicker text-primary">Savings</p>
            <h1 className="text-lg font-display font-bold text-foreground leading-tight">Goals</h1>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="w-10 h-10 rounded-full bg-primary flex items-center justify-center"
            aria-label="New goal"
          >
            <Plus size={20} className="text-primary-foreground" />
          </button>
        </div>

        <GlassCard elevated>
          <p className="text-sm text-muted-foreground mb-1">Saved toward goals</p>
          <p className="text-serif-display text-4xl text-foreground tabular-nums">{money(totalSaved)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {goals.length === 0 ? "No goals yet" : `of ${money(totalTarget)} across ${goals.length} goal${goals.length > 1 ? "s" : ""}`}
          </p>
        </GlassCard>

        {/* Round-ups */}
        <GlassCard className="space-y-3">
          <div className="flex items-center gap-2">
            <Coins size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Round-ups</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Round every card purchase up to the next dollar and sweep the change into a goal.
            About <span className="font-semibold text-foreground">{money(pendingRoundUp)}</span> is available from the last 30 days.
          </p>
          <select
            value={roundUpGoalId ?? ""}
            onChange={(e) => void setRoundUpGoal(e.target.value || null)}
            className="w-full p-3 rounded-xl bg-secondary text-foreground text-sm border-0 outline-none"
          >
            <option value="">Round-ups off</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>{g.emoji} {g.name}</option>
            ))}
          </select>
          <button
            onClick={() => void runRoundUpSweep()}
            disabled={!roundUpGoalId}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Sparkles size={16} /> Sweep round-ups now
          </button>
        </GlassCard>

        {goals.length === 0 ? (
          <GlassCard className="text-center py-10">
            <Target size={36} className="text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-semibold text-foreground">No goals yet</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">Create one and start putting money aside.</p>
            <button onClick={() => setCreateOpen(true)} className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">
              Create a goal
            </button>
          </GlassCard>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {goals.map((g) => {
              const pct = g.targetAmount > 0 ? Math.min(100, (g.saved / g.targetAmount) * 100) : 0;
              const done = g.saved >= g.targetAmount;
              return (
                <GlassCard key={g.id} className="space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{g.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{g.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {money(g.saved)} of {money(g.targetAmount)} · by{" "}
                        {new Date(`${g.targetDate}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                    <button
                      onClick={() => void deleteGoal(g.id)}
                      className="p-2 rounded-lg bg-secondary text-muted-foreground"
                      aria-label={`Delete ${g.name}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
                    <div
                      className={`h-full rounded-full ${done ? "bg-success" : "gradient-navy"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {done ? "Goal reached 🎉" : `${Math.round(pct)}% · ${money(Math.max(0, g.targetAmount - g.saved))} to go`}
                    </span>
                    <button
                      onClick={() => { setContributeFor(g.id); setAmount(""); }}
                      className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold"
                    >
                      Add money
                    </button>
                  </div>
                  {g.contributions.length > 0 && (
                    <div className="pt-2 border-t border-border space-y-1">
                      {g.contributions.slice(0, 3).map((c) => (
                        <div key={c.id} className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>{c.source === "round-up" ? "Round-up sweep" : "Manual contribution"}</span>
                          <span className="tabular-nums">+{money(c.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </GlassCard>
              );
            })}
          </div>
        )}
      </div>

      {/* Create sheet */}
      <AnimatePresence>
        {createOpen && (
          <Sheet onClose={() => setCreateOpen(false)} title="New goal">
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Goal name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Emergency Fund"
                  className="w-full p-3 rounded-xl bg-secondary text-foreground text-sm border-0 outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Icon</label>
                <div className="flex gap-2 flex-wrap">
                  {EMOJIS.map((e) => (
                    <button
                      key={e}
                      onClick={() => setEmoji(e)}
                      className={`w-10 h-10 rounded-xl text-lg ${emoji === e ? "bg-primary/15 ring-2 ring-primary" : "bg-secondary"}`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Target amount</label>
                <input
                  inputMode="decimal"
                  value={target}
                  onChange={(e) => setTarget(e.target.value.replace(/[^\d.]/g, ""))}
                  placeholder="5000"
                  className="w-full p-3 rounded-xl bg-secondary text-foreground text-sm border-0 outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Target date</label>
                <input
                  type="date"
                  value={targetDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full p-3 rounded-xl bg-secondary text-foreground text-sm border-0 outline-none"
                />
              </div>
              <button
                onClick={() => void submitCreate()}
                disabled={busy}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
              >
                Create goal
              </button>
            </div>
          </Sheet>
        )}
      </AnimatePresence>

      {/* Contribute sheet */}
      <AnimatePresence>
        {contributeFor && (
          <Sheet onClose={() => setContributeFor(null)} title="Add to goal">
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Moves money from {accounts.checking?.name ?? "checking"} ({money(accounts.checking?.availableBalance ?? 0)} available)
                into your savings and earmarks it for this goal.
              </p>
              <input
                autoFocus
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="50.00"
                className="w-full p-4 rounded-xl bg-secondary text-foreground text-2xl font-semibold tabular-nums border-0 outline-none text-center"
              />
              <button
                onClick={() => void submitContribution()}
                disabled={busy}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
              >
                Add money
              </button>
            </div>
          </Sheet>
        )}
      </AnimatePresence>
    </div>
  );
};

const Sheet = ({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) => (
  <motion.div
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    onClick={onClose}
    className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm"
  >
    <motion.div
      initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 32, stiffness: 320 }}
      onClick={(e) => e.stopPropagation()}
      className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl px-5 pt-5 max-h-[90vh] overflow-y-auto sheet-panel"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-display font-bold text-foreground">{title}</h2>
        <button onClick={onClose} className="p-2 rounded-lg bg-secondary" aria-label="Close">
          <X size={16} className="text-muted-foreground" />
        </button>
      </div>
      {children}
    </motion.div>
  </motion.div>
);

export default Goals;

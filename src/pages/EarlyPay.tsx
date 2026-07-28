import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import GlassCard from "@/components/glass/GlassCard";
import { useBank } from "@/store/bankStore";
import { ArrowLeft, Zap, CalendarClock, CheckCircle2, Info } from "lucide-react";

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

const EarlyPay = () => {
  const navigate = useNavigate();
  const { payroll, earlyPayouts, releaseEarlyPaycheck, accounts } = useBank();

  return (
    <div className="min-h-dvh bg-background">
      <div className="px-5 sm:px-6 lg:px-0 pt-10 sm:pt-12 space-y-5 pb-12">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="h-11 w-11 rounded-full bg-secondary flex items-center justify-center press">
            <ArrowLeft size={20} className="text-foreground" />
          </button>
          <div>
            <p className="kicker text-primary">Paycheck</p>
            <h1 className="text-lg font-display font-bold text-foreground leading-tight">Get paid early</h1>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {!payroll ? (
            <GlassCard className="text-center py-10">
              <CalendarClock size={36} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-semibold text-foreground">No payroll pattern detected yet</p>
              <p className="text-xs text-muted-foreground mt-1 px-6">
                Once we see a few recurring direct deposits from the same employer, early access unlocks automatically.
              </p>
              <button onClick={() => navigate("/direct-deposit")} className="mt-4 text-xs font-semibold text-primary">
                Set up direct deposit →
              </button>
            </GlassCard>
          ) : (
            <>
              <GlassCard elevated className="space-y-3">
                <div className="flex items-center gap-2">
                  <Zap size={16} className="text-primary" />
                  <p className="text-sm font-semibold text-foreground">Next expected paycheck</p>
                </div>
                <p className="text-serif-display text-4xl text-foreground tabular-nums">
                  {money(payroll.averageAmount)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {payroll.merchant} · {dateLabel(payroll.nextExpectedAt)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {payroll.daysUntilNext === 0
                    ? "Expected today"
                    : `In ${payroll.daysUntilNext} day${payroll.daysUntilNext === 1 ? "" : "s"} · every ${payroll.intervalDays} days`}
                </p>

                {payroll.alreadyAdvanced ? (
                  <div className="flex items-start gap-2 rounded-xl bg-secondary p-3">
                    <CheckCircle2 size={16} className="text-success mt-0.5 shrink-0" />
                    <p className="text-xs text-foreground">
                      Already released early. When {dateLabel(payroll.nextExpectedAt)} arrives, this deposit is marked
                      as received — you won't be paid twice.
                    </p>
                  </div>
                ) : payroll.eligibleNow ? (
                  <button
                    onClick={() => void releaseEarlyPaycheck()}
                    className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold press"
                  >
                    Get {money(payroll.averageAmount)} now
                  </button>
                ) : (
                  <div className="rounded-xl bg-secondary p-3">
                    <p className="text-xs text-muted-foreground">
                      Early access opens 2 days before payday. Check back on{" "}
                      {dateLabel(new Date(+new Date(payroll.nextExpectedAt) - 2 * 86400000).toISOString())}.
                    </p>
                  </div>
                )}
              </GlassCard>

              <GlassCard className="flex items-start gap-3">
                <Info size={16} className="text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Funds land in {accounts.checking?.name ?? "your checking account"} instantly, at no cost. The amount is
                  based on your recent deposits from {payroll.merchant}; if your actual pay differs, the difference is
                  settled on payday.
                </p>
              </GlassCard>
            </>
          )}

          {earlyPayouts.length > 0 && (
            <div className="space-y-2">
              <p className="kicker text-muted-foreground px-1">Early releases</p>
              {earlyPayouts.map((p) => (
                <GlassCard key={p.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{p.merchant}</p>
                    <p className="text-xs text-muted-foreground">
                      Released {new Date(p.releasedAt).toLocaleDateString()} ·{" "}
                      {p.settledAt ? "Settled on payday" : `Settles ${new Date(p.expectedDate).toLocaleDateString()}`}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-success tabular-nums">+{money(p.amount)}</span>
                </GlassCard>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default EarlyPay;

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import GlassCard from "@/components/glass/GlassCard";
import { useBank } from "@/store/bankStore";
import { ArrowLeft, Coins, Sparkle, Info } from "lucide-react";

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

const Rewards = () => {
  const navigate = useNavigate();
  const { cashback, redeemCashback, accounts, card } = useBank();
  const [busy, setBusy] = useState(false);

  const redeem = async () => {
    setBusy(true);
    await redeemCashback();
    setBusy(false);
  };

  const recent = (cashback?.entries ?? []).slice(0, 12);
  const canRedeem = (cashback?.available ?? 0) >= 1;

  return (
    <div className="min-h-screen bg-background">
      <div className="px-5 pt-14 space-y-5 pb-12">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center press" aria-label="Back">
            <ArrowLeft size={20} className="text-foreground" />
          </button>
          <div>
            <p className="kicker text-primary">Glass Card</p>
            <h1 className="text-lg font-display font-bold text-foreground leading-tight">Cashback rewards</h1>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <GlassCard elevated className="relative overflow-hidden">
            <div className="absolute inset-0 gradient-hero opacity-[0.08] rounded-2xl" />
            <div className="relative space-y-3">
              <div className="flex items-center gap-2">
                <Coins size={16} className="text-primary" />
                <p className="text-sm font-semibold text-foreground">Available to redeem</p>
              </div>
              <p className="text-serif-display text-4xl text-foreground tabular-nums">
                {money(cashback?.available ?? 0)}
              </p>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="rounded-xl bg-secondary p-3">
                  <p className="text-[11px] text-muted-foreground">This month</p>
                  <p className="text-base font-semibold text-foreground tabular-nums">
                    {money(cashback?.thisMonthEarned ?? 0)}
                  </p>
                </div>
                <div className="rounded-xl bg-secondary p-3">
                  <p className="text-[11px] text-muted-foreground">All time</p>
                  <p className="text-base font-semibold text-foreground tabular-nums">
                    {money(cashback?.allTimeEarned ?? 0)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => void redeem()}
                disabled={!canRedeem || busy}
                className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold press disabled:opacity-50"
              >
                {busy
                  ? "Redeeming…"
                  : canRedeem
                    ? `Redeem ${money(cashback?.available ?? 0)} to ${accounts.checking?.name ?? "checking"}`
                    : "Earn $1.00 to redeem"}
              </button>
              {(cashback?.redeemed ?? 0) > 0 && (
                <p className="text-xs text-muted-foreground text-center">
                  {money(cashback?.redeemed ?? 0)} already redeemed
                </p>
              )}
            </div>
          </GlassCard>

          <GlassCard className="flex items-start gap-3">
            <Sparkle size={16} className="text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              Earn <span className="text-foreground font-semibold">1% back</span> on every purchase with your{" "}
              {card?.nickname ?? "Glass Card"}. Rewards accrue instantly and never expire — redeem any time to your
              checking account as a real deposit.
            </p>
          </GlassCard>

          <div className="space-y-2">
            <p className="kicker text-muted-foreground px-1">Recent earnings</p>
            {recent.length === 0 ? (
              <GlassCard className="text-center py-8">
                <Info size={28} className="text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No card purchases yet — spend to start earning.</p>
              </GlassCard>
            ) : (
              recent.map((e) => (
                <GlassCard key={e.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{e.merchant}</p>
                    <p className="text-xs text-muted-foreground">
                      {money(e.spend)} · {new Date(e.date).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-success tabular-nums">+{money(e.earned)}</span>
                </GlassCard>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Rewards;
